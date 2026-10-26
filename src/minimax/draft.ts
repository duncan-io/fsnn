import { createLookups, type LookupPlayer } from "../search/lookup";
import { completeTurn, type CompleteOptions, type MiniMaxMessage } from "./client";
import { extractJson } from "./json";

const LOOKUP_TURNS = 4;

const LOOKUP_TOOL = {
  type: "function",
  function: {
    name: "lookup_player",
    description:
      "Look up how a rostered player performed in this NFL week when the sheet does not already explain the score.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["playerName"],
      properties: { playerName: { type: "string" } },
    },
  },
};

export async function minimaxJsonDraft<T>(args: {
  system: string;
  user: string;
  players: LookupPlayer[];
  week: number;
  parse: (value: unknown) => T;
  maxTokens?: number;
  temperature?: number;
  turn?: typeof completeTurn;
  lookup?: { snippets: string[]; run: (playerName: string) => Promise<string> };
}): Promise<{ value: T; snippets: string[] }> {
  const turn = args.turn ?? completeTurn;
  const options: CompleteOptions = {};
  if (args.maxTokens != null) options.maxTokens = args.maxTokens;
  if (args.temperature != null) options.temperature = args.temperature;
  const lookups = args.lookup ?? createLookups(args.players, args.week);
  const messages: MiniMaxMessage[] = [
    { role: "system", content: args.system },
    { role: "user", content: args.user },
  ];
  for (let step = 0; step < LOOKUP_TURNS; step += 1) {
    const result = await turn(messages, [LOOKUP_TOOL], options);
    if (result.toolCalls.length === 0) {
      if (!result.content) throw new Error("MiniMax returned an empty draft.");
      return { value: args.parse(extractJson(result.content)), snippets: lookups.snippets };
    }
    messages.push({
      role: "assistant",
      content: result.content || null,
      tool_calls: result.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });
    for (const call of result.toolCalls) {
      const name = readPlayerName(call.arguments);
      const content =
        call.name === "lookup_player" && name ? await lookups.run(name) : "Use lookup_player with a rostered player name.";
      messages.push({ role: "tool", tool_call_id: call.id, content });
    }
  }
  throw new Error("Draft did not return JSON.");
}

function readPlayerName(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { playerName?: unknown };
    return typeof parsed.playerName === "string" ? parsed.playerName : null;
  } catch {
    return null;
  }
}
