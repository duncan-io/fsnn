import { describe, expect, test } from "bun:test";
import { columnCard, lastShowCard, rankingsLines, recapCards } from "./desk";

describe("desk cards", () => {
  test("keeps one short recap card per matchup", () => {
    const cards = recapCards({
      writer: "Kevin Marsh",
      body: {
        lede: "A long lede that stays off the card.",
        sections: [
          {
            matchupKey: "a:b",
            heading: "Wolves hold on",
            paragraphs: ["Wolves scored 120 to beat Bench.", "The second paragraph stays off the card."],
          },
          { matchupKey: "c:d", heading: "Hail", paragraphs: ["", "This is not the first paragraph."] },
        ],
        kicker: "A kicker stays off the card.",
      },
      cards: [{ matchupKey: "a:b", headline: "Wolves pull away", dek: "A late score" }],
      names: new Map([["a:b", ["Wolves", "Bench"]]]),
    });
    expect(cards).toEqual([
      {
        matchupKey: "a:b",
        writer: "Kevin Marsh",
        headline: "Wolves pull away",
        dek: "A late score",
        heading: "Wolves hold on",
        sentence: "Wolves scored 120 to beat Bench.",
        teamNames: ["Wolves", "Bench"],
      },
    ]);
  });

  test("keeps one rankings line per team", () => {
    const lines = rankingsLines({
      week: 5,
      writer: "Ada Quinn",
      headline: "Wolves stay on top",
      body: {
        lede: "A long lede.",
        entries: [
          { teamKey: "a", paragraphs: ["Wolves scored 120.", "Second stays off."] },
          { teamKey: "b", paragraphs: ["Bench scored 110."] },
          { teamKey: "missing", paragraphs: ["Nobody knows this club."] },
        ],
        kicker: null,
      },
      teams: [
        { teamKey: "a", teamName: "Wolves" },
        { teamKey: "b", teamName: "Bench" },
      ],
    });
    expect(lines).toEqual([
      {
        week: 5,
        writer: "Ada Quinn",
        headline: "Wolves stay on top",
        teamKey: "a",
        teamName: "Wolves",
        sentence: "Wolves scored 120.",
      },
      {
        week: 5,
        writer: "Ada Quinn",
        headline: "Wolves stay on top",
        teamKey: "b",
        teamName: "Bench",
        sentence: "Bench scored 110.",
      },
    ]);
  });

  test("drops a draft column and keeps a published claim plus one counter", () => {
    const draft = columnCard({
      status: "draft",
      writer: "Jerry Crowe",
      desk: "results",
      headline: "Wolves are done",
      week: 6,
      teamKeys: ["a"],
      brief: { claim: "Wolves are done.", counterEvidence: ["They scored 120."] },
    });
    expect(draft).toBeNull();
    const published = columnCard({
      status: "published",
      writer: "Greg Pell",
      desk: "results",
      headline: "Wolves are the club to beat",
      week: 6,
      teamKeys: ["a"],
      teamNames: ["Wolves"],
      brief: { claim: "Wolves are the club to beat.", counterEvidence: ["Bench scored 110.", "A second counter stays off."] },
    });
    expect(published).toEqual({
      writer: "Greg Pell",
      desk: "results",
      headline: "Wolves are the club to beat",
      claim: "Wolves are the club to beat.",
      counter: "Bench scored 110.",
      teamKeys: ["a"],
      teamNames: ["Wolves"],
      week: 6,
    });
  });

  test("keeps last week's stances and leaves the dialogue off the card", () => {
    const card = lastShowCard(5, "The Dig, Week 5: Bench is fine", {
      outline: {
        sections: [
          {
            angle: "Wolves are ahead.",
            jerry: "Wolves are the better club.",
            greg: "Bench is closer than that score.",
          },
        ],
      },
      segments: [{ lines: [{ speaker: "jerry", text: "A spoken line that stays off the card." }] }],
    });
    expect(card).toEqual({
      week: 5,
      title: "The Dig, Week 5: Bench is fine",
      sections: [
        {
          angle: "Wolves are ahead.",
          jerry: "Wolves are the better club.",
          greg: "Bench is closer than that score.",
        },
      ],
    });
  });
});
