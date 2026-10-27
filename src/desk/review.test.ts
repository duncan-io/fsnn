import { describe, expect, test } from "bun:test";
import { draftUntil, readFlags, REWRITES, reviewWithMinimax, reviewWithOpenAi } from "./review";

describe("readFlags", () => {
  test("reads reasons and treats an empty list as a pass", () => {
    expect(readFlags({ flags: [] })).toEqual([]);
    expect(readFlags({ flags: [{ reason: " Dek misses the standings. " }] })).toEqual([
      "Dek misses the standings.",
    ]);
  });

  test("rejects a review that is not the flag list", () => {
    expect(readFlags(null)).toEqual(["Editor review was not JSON."]);
    expect(readFlags({ flags: [{ reason: "" }] })).toEqual(["Editor review was not JSON."]);
  });
});

describe("draftUntil", () => {
  test("stops when the facts and the editor both pass", async () => {
    const writes: string[][] = [];
    let edits = 0;
    const result = await draftUntil({
      write: async (notes) => {
        writes.push(notes);
        return writes.length;
      },
      facts: (draft) => (draft < 2 ? ["Invented number 9."] : []),
      edit: async () => {
        edits += 1;
        return edits < 2 ? ["Dek misses the standings."] : [];
      },
    });
    expect(result).toEqual({ ok: true, draft: 3 });
    expect(writes).toEqual([[], ["Invented number 9."], ["Dek misses the standings."]]);
    expect(edits).toBe(2);
  });

  test("skips the editor while the facts fail", async () => {
    let edits = 0;
    const result = await draftUntil({
      write: async () => "draft",
      facts: () => ["Lede must be two sentences."],
      edit: async () => {
        edits += 1;
        return [];
      },
    });
    expect(edits).toBe(0);
    expect(result).toEqual({ ok: false, draft: "draft", notes: ["Lede must be two sentences."] });
  });

  test("holds the last readable draft after three rewrites", async () => {
    let writes = 0;
    const result = await draftUntil({
      write: async () => {
        writes += 1;
        return `draft ${writes}`;
      },
      facts: () => [],
      edit: async (draft) => [`${draft} misses the claim.`],
    });
    expect(writes).toBe(REWRITES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.draft).toBe("draft 4");
      expect(result.notes).toEqual(["draft 4 misses the claim."]);
    }
  });

  test("throws when every attempt is unreadable", async () => {
    let writes = 0;
    await expect(
      draftUntil({
        write: async () => {
          writes += 1;
          throw new Error("Draft was not JSON.");
        },
        facts: () => [],
        edit: async () => [],
      }),
    ).rejects.toThrow("Draft was not JSON.");
    expect(writes).toBe(REWRITES + 1);
  });
});

describe("reviewWithOpenAi", () => {
  test("sends the goal at a low temperature and reads the flags", async () => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousModel = process.env.OPENAI_MODEL;
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    let body: Record<string, unknown> = {};
    const complete: typeof fetch = async (_url, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        choices: [{ message: { content: JSON.stringify({ flags: [{ reason: "Headline has no score." }] }) } }],
      });
    };
    try {
      const flags = await reviewWithOpenAi({
        goal: "The headline carries a true score.",
        brief: "Week 2",
        copy: "Wolves roll.",
        complete,
      });
      expect(flags).toEqual(["Headline has no score."]);
      expect(body.temperature).toBe(0.2);
      expect(body.tools).toBeUndefined();
      const messages = body.messages as Array<{ role: string; content: string }>;
      expect(messages[0]?.content).toContain("The headline carries a true score.");
      expect(messages[0]?.content).toContain("You do not rewrite it.");
      expect(messages[1]?.content).toContain("Wolves roll.");
    } finally {
      process.env.OPENAI_API_KEY = previousKey;
      process.env.OPENAI_MODEL = previousModel;
    }
  });

  test("treats an empty review as a failed check", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "test-model";
    const complete: typeof fetch = async () => Response.json({ choices: [{ message: { content: "" } }] });
    const flags = await reviewWithOpenAi({ goal: "Argue the claim.", brief: "Claim", copy: "Copy", complete });
    expect(flags).toEqual(["Editor review was empty."]);
  });
});

describe("reviewWithMinimax", () => {
  test("asks for flags and does not rewrite", async () => {
    let temperature = 0;
    const flags = await reviewWithMinimax({
      goal: "The column argues the claim in the brief.",
      brief: "Claim: Wolves are frauds.",
      copy: "Wolves won.",
      turn: async (messages, tools, options) => {
        temperature = options?.temperature ?? 0;
        expect(tools).toBeUndefined();
        expect(messages[0]?.content).toContain("You do not rewrite it.");
        expect(messages[0]?.content).toContain("argues the claim");
        return { content: '{"flags":[]}', toolCalls: [] };
      },
    });
    expect(flags).toEqual([]);
    expect(temperature).toBe(0.2);
  });
});
