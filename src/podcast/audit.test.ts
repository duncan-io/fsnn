import { describe, expect, test } from "bun:test";
import { auditOutline, auditScript, auditSection } from "./audit";
import type { PlannedSegment, PodcastOutline, PodcastScript, ScriptLine, ScriptSegment } from "./types";

describe("auditSection", () => {
  test("rejects an invented number, an unknown name, and banned words", () => {
    expect(errors("open", talk(`The Dig ${fill(39)}`, fill(40)))).toEqual([]);
    expect(errors("open", talk(`The Dig ${fill(38)} 99`, fill(40)))).toContain("Invented number 99.");
    expect(errors("open", talk(`The Dig Zelda ${fill(38)}`, fill(40)))).toContain("Unknown name Zelda.");
    expect(errors("open", talk(`The Dig ${fill(38)} fantasy`, fill(40)))).toContain("Do not say fantasy.");
    expect(errors("open", talk(`The Dig ${fill(38)} Yahoo`, fill(40)))).toContain("Do not say Yahoo.");
  });

  test("rejects a short section and an open that forgets the show", () => {
    expect(errors("open", talk(fill(20), fill(20)))).toContain("The open must say The Dig.");
    expect(errors("open", talk(fill(10), fill(10)))).toContainEqual(expect.stringContaining("outside its word budget"));
    expect(errors("close", talk(fill(40), fill(40)))).toContain("The close must say The Dig.");
  });

  test("rejects a preview that calls the game already played", () => {
    const planned = slot("preview");
    planned.kind = "preview";
    planned.budget = 100;
    planned.previewTeams = ["Wolves", "Bench"];
    planned.facts = { home: "Wolves", away: "Bench" };
    const result = auditSection(planned, {
      id: "preview",
      kind: "preview",
      matchupKey: null,
      lines: talk(`Wolves beat Bench today. ${fill(30)}`, fill(40)),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Wolves and Bench have not played yet.");
  });

  test("allows last week only when the earlier episode is on the sheet", () => {
    const bare = auditSection(openSlot(), { id: "open", kind: "open", matchupKey: null, lines: talk(`The Dig last week ${fill(36)}`, fill(40)) });
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.errors).toContain("Last week is not on the sheet.");

    const fromSheet = auditSection(openSlot(lastShow()), {
      id: "open",
      kind: "open",
      matchupKey: null,
      lines: talk(`The Dig last week Bench is the better club. ${fill(31)}`, fill(40)),
    });
    expect(fromSheet.ok).toBe(true);

    const fromLookup = auditSection(
      openSlot(),
      { id: "open", kind: "open", matchupKey: null, lines: talk(`The Dig last week ${fill(36)}`, fill(40)) },
      ["Last show week 5. Bench is the better club."],
    );
    expect(fromLookup.ok).toBe(true);
  });
});

describe("auditOutline", () => {
  test("the close has to answer the open when last week is on the sheet", () => {
    const plan = [openSlot(lastShow()), closeSlot()];
    const missed = auditOutline(plan, payoff("the week settled it."));
    expect(missed.ok).toBe(false);
    if (!missed.ok) expect(missed.errors).toContain("The close has to answer the open.");

    expect(auditOutline(plan, payoff("Wolves were proved right.")).ok).toBe(true);
    const fresh = openSlot();
    fresh.facts = { show: "The Dig with Greg and Jerry", leagueName: "Guild", recapWeek: 6, clubs: ["Wolves", "Bench"] };
    expect(auditOutline([fresh, closeSlot()], payoff("the week settled it.")).ok).toBe(true);
  });
});

describe("auditScript", () => {
  test("rejects a missing section, a lopsided show, and a repeated opener", () => {
    const missing = auditScript([slot("open"), slot("close")], script([block("open", "jerry", 100)]));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.join("\n")).toContain("Missing section close.");

    const lopsided = auditScript(
      [slot("open"), slot("close")],
      script([block("open", "jerry", 1400, "greg", 200), block("close", "jerry", 0, "greg", 200)]),
    );
    expect(lopsided.ok).toBe(false);
    if (!lopsided.ok) expect(lopsided.errors.join("\n")).toContain("Greg has less than 35% of the words.");

    const opener = "wolves are not a real club";
    const repeated = auditScript(
      [slot("open"), slot("recap:a"), slot("close")],
      script([
        block("open", "jerry", 20, "greg", 20, opener),
        block("recap:a", "jerry", 20, "greg", 20, opener),
        block("close", "jerry", 20, "greg", 20, opener),
      ]),
    );
    expect(repeated.ok).toBe(false);
    if (!repeated.ok) expect(repeated.errors.join("\n")).toContain(`Repeated phrase "${opener}"`);
  });
});

function errors(kind: PlannedSegment["kind"], lines: ScriptLine[]): string[] {
  const planned = slot(kind);
  planned.kind = kind;
  planned.budget = 100;
  planned.facts = { show: "The Dig with Greg and Jerry", leagueName: "Guild", recapWeek: 6 };
  const result = auditSection(planned, { id: kind, kind, matchupKey: null, lines });
  return result.ok ? [] : result.errors;
}

function talk(jerry: string, greg: string): ScriptLine[] {
  return [
    { speaker: "jerry", text: jerry },
    { speaker: "greg", text: greg },
  ];
}

function fill(count: number): string {
  return Array.from({ length: count }, () => "alpha").join(" ");
}

function openSlot(desk?: unknown): PlannedSegment {
  const planned = slot("open");
  planned.budget = 100;
  planned.facts = desk
    ? { show: "The Dig with Greg and Jerry", leagueName: "Guild", recapWeek: 6, desk }
    : { show: "The Dig with Greg and Jerry", leagueName: "Guild", recapWeek: 6 };
  return planned;
}

function closeSlot(): PlannedSegment {
  const planned = slot("close");
  planned.kind = "close";
  planned.budget = 100;
  planned.facts = { show: "The Dig with Greg and Jerry", leagueName: "Guild", recapWeek: 6, clubs: ["Wolves", "Bench"] };
  return planned;
}

function lastShow() {
  return {
    week: 5,
    title: "The Dig, Week 5: Bench is fine",
    sections: [{ angle: "Wolves are ahead.", jerry: "Wolves are the better club.", greg: "Bench is closer." }],
  };
}

function payoff(closeAngle: string): PodcastOutline {
  return {
    title: "Wolves",
    description: "Wolves are ahead.",
    sections: [
      {
        id: "open",
        angle: "Wolves are ahead.",
        jerry: "Wolves are the better club.",
        greg: "Bench is closer.",
        facts: ["Wolves are ahead."],
        handoff: "next",
      },
      {
        id: "close",
        angle: closeAngle,
        jerry: "the score still stands.",
        greg: "the score can wait.",
        facts: ["Wolves are ahead."],
        handoff: "",
      },
    ],
  };
}

function slot(id: string): PlannedSegment {
  return {
    id,
    kind: "open",
    matchupKey: null,
    budget: 100,
    facts: {},
    players: [],
    results: [],
    ranks: [],
    playerPoints: [],
    previewTeams: null,
  };
}

function script(segments: ScriptSegment[]): PodcastScript {
  return {
    title: "The Dig, Week 6: test",
    description: "A test episode.",
    outline: { title: "test", description: "A test episode.", sections: [] },
    segments,
  };
}

function block(id: string, first: "jerry" | "greg", firstWords: number, second?: "jerry" | "greg", secondWords = 0, opener = ""): ScriptSegment {
  const lines: ScriptLine[] = [];
  if (firstWords > 0) lines.push({ speaker: first, text: `${opener} ${fill(firstWords)}`.trim() });
  if (second && secondWords > 0) lines.push({ speaker: second, text: fill(secondWords) });
  return { id, kind: "open", matchupKey: null, lines };
}
