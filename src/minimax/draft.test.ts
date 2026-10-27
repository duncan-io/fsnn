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

  test("omits lookup_player when lookup is turned off", async () => {
    let names: string[] = [];
    await minimaxJsonDraft({
      system: "system",
      user: "user",
      players: [],
      week: 6,
      lookupPlayer: false,
      parse: (value) => value,
      turn: async (_messages, tools) => {
        names = ((tools ?? []) as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
        return { content: '{"ok":true}', toolCalls: [] };
      },
    });
    expect(names).toEqual([]);
  });

  test("exposes only lookup_player unless extra tools are passed", async () => {
    let names: string[] = [];
    await minimaxJsonDraft({
      system: "system",
      user: "user",
      players: [],
      week: 6,
      parse: (value) => value,
      turn: async (_messages, tools) => {
        names = ((tools ?? []) as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
        return { content: '{"ok":true}', toolCalls: [] };
      },
    });
    expect(names).toEqual(["lookup_player"]);
  });

  test("dispatches an extra tool and keeps a hit in snippets", async () => {
    let names: string[] = [];
    let called = false;
    const result = await minimaxJsonDraft({
      system: "system",
      user: "user",
      players: [],
      week: 6,
      parse: (value) => value as { ok: boolean },
      tools: [
        {
          spec: {
            type: "function",
            function: { name: "lookup_story", description: "story", parameters: { type: "object", properties: {} } },
          },
          run: async () => ({ content: "Desk recap by Kevin. Wolves scored 120.", snippet: "Desk recap by Kevin. Wolves scored 120." }),
        },
      ],
      turn: async (_messages, tools) => {
        names = ((tools ?? []) as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
        if (!called) {
          called = true;
          return { content: "", toolCalls: [{ id: "call-2", name: "lookup_story", arguments: "{}" }] };
        }
        return { content: '{"ok":true}', toolCalls: [] };
      },
    });
    expect(names).toEqual(["lookup_player", "lookup_story"]);
    expect(result.snippets).toEqual(["Desk recap by Kevin. Wolves scored 120."]);
    expect(result.value.ok).toBe(true);
  });

  test("a tool miss does not add a snippet", async () => {
    let called = false;
    const result = await minimaxJsonDraft({
      system: "system",
      user: "user",
      players: [],
      week: 6,
      parse: (value) => value as { ok: boolean },
      tools: [
        {
          spec: {
            type: "function",
            function: { name: "lookup_story", description: "story", parameters: { type: "object", properties: {} } },
          },
          run: async () => ({ content: "No story for that club.", snippet: null }),
        },
      ],
      turn: async () => {
        if (!called) {
          called = true;
          return { content: "", toolCalls: [{ id: "call-3", name: "lookup_story", arguments: "{}" }] };
        }
        return { content: '{"ok":true}', toolCalls: [] };
      },
    });
    expect(result.snippets).toEqual([]);
    expect(result.value.ok).toBe(true);
  });
});
