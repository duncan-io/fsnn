import { describe, expect, test } from "bun:test";
import type { MiniMaxMessage } from "./client";
import { minimaxJsonDraft } from "./draft";
import { extractJson } from "./json";

describe("extractJson", () => {
  test("reads fenced JSON and ignores a thinking trace", () => {
    const value = extractJson(`<think>draft</think>\n\`\`\`json\n{"ok":true}\n\`\`\``) as { ok: boolean };
    expect(value.ok).toBe(true);
  });

  test("rejects a response with no object", () => {
    expect(() => extractJson("no json here")).toThrow(/not JSON/);
  });
});

describe("minimaxJsonDraft", () => {
  test("runs a lookup and then parses the draft", async () => {
    const seen: MiniMaxMessage[][] = [];
    const snippets: string[] = [];
    const result = await minimaxJsonDraft({
      system: "system",
      user: "user",
      players: [],
      week: 6,
      parse: (value) => value as { ok: boolean },
      lookup: {
        snippets,
        async run(playerName: string) {
          snippets.push(playerName);
          return `notes for ${playerName}`;
        },
      },
      turn: async (messages) => {
        seen.push(messages);
        if (seen.length === 1) {
          return {
            content: "",
            toolCalls: [{ id: "call-1", name: "lookup_player", arguments: '{"playerName":"Star Back"}' }],
          };
        }
        return { content: '{"ok":true}', toolCalls: [] };
      },
    });
    expect(result.value.ok).toBe(true);
    expect(result.snippets).toEqual(["Star Back"]);
    expect(seen[1]?.some((message) => message.role === "tool" && message.content === "notes for Star Back")).toBe(true);
  });
});
