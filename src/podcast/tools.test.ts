import { describe, expect, test } from "bun:test";
import { EMPTY_DESK, type DeskContext } from "./desk";
import { deskTools } from "./tools";

const desk: DeskContext = {
  recaps: [
    {
      matchupKey: "a:b",
      writer: "Kevin Marsh",
      headline: "Wolves pull away",
      dek: "A late score",
      heading: "Wolves hold on",
      sentence: "Wolves scored 120 to beat Bench.",
      teamNames: ["Wolves", "Bench"],
    },
  ],
  rankings: [
    {
      week: 5,
      writer: "Ada Quinn",
      headline: "Wolves stay on top",
      teamKey: "a",
      teamName: "Wolves",
      sentence: "Wolves scored 120.",
    },
  ],
  columns: [
    {
      writer: "Greg Pell",
      desk: "waivers",
      headline: "Hail should spend",
      claim: "Hail should spend the budget.",
      counter: "The wire is thin.",
      teamKeys: ["c"],
      teamNames: ["Hail"],
      week: 6,
    },
  ],
  lastShow: {
    week: 5,
    title: "The Dig, Week 5: Bench is fine",
    sections: [{ angle: "Wolves are ahead.", jerry: "Wolves are the better club.", greg: "Bench is closer." }],
  },
};

describe("desk tools", () => {
  test("returns the matching card", async () => {
    const tools = deskTools(desk);
    const story = await run(tools, "lookup_story", { name: "Wolves" });
    expect(story.snippet).toContain("Desk recap by Kevin Marsh");
    expect(story.snippet).toContain("Wolves scored 120 to beat Bench.");
    const column = await run(tools, "lookup_story", { name: "Hail" });
    expect(column.snippet).toContain("Greg Pell on waivers");
    expect(column.snippet).toContain("Hail should spend the budget.");
    const rankings = await run(tools, "lookup_rankings", { name: "Wolves" });
    expect(rankings.snippet).toContain("Rankings week 5 by Ada Quinn");
    expect(rankings.snippet).toContain("Wolves: Wolves scored 120.");
    const show = await run(tools, "lookup_last_show", {});
    expect(show.snippet).toContain("Last show week 5");
    expect(show.snippet).toContain("Jerry: Wolves are the better club.");
  });

  test("a miss adds no snippet and no number", async () => {
    const tools = deskTools(desk);
    const story = await run(tools, "lookup_story", { name: "Zebras" });
    expect(story).toEqual({ content: "No story for that club.", snippet: null });
    expect(story.content).not.toMatch(/\d/);
    const rankings = await run(tools, "lookup_rankings", { name: "Zebras" });
    expect(rankings.snippet).toBeNull();
    expect(rankings.content).not.toMatch(/\d/);
    const show = await run(deskTools(EMPTY_DESK), "lookup_last_show", {});
    expect(show).toEqual({ content: "No earlier episode.", snippet: null });
    expect(show.content).not.toMatch(/\d/);
  });
});

async function run(tools: ReturnType<typeof deskTools>, name: string, args: unknown) {
  const tool = tools.find((item) => item.spec.function.name === name);
  if (!tool) throw new Error(`Missing ${name}`);
  return tool.run(JSON.stringify(args));
}
