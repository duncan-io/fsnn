import { IN_UNIVERSE, personas } from "../personas/staff";
import { SHOW } from "./show";

const SHARED = [
  `This is ${SHOW.title}. Jerry Crowe takes the strong reading and Greg Pell gives the calmer counter.`,
  "They argue about football and stay friends. The heat stays on the roster or the result, never the person.",
  "Neither host quotes the other or invents what the other said off the air.",
  "Spoken words only. No markdown, no stage directions, no brackets, no emoji, and no links.",
  "Capitalize a word only when it is a name from the facts, or part of The Dig. Do not capitalize the first word of a sentence.",
  "Write every number as the digits given in the facts. Do not round, and do not invent a number.",
  "Never say fantasy. Never say Yahoo.",
  IN_UNIVERSE,
].join(" ");

export function outlineStyle(): string {
  return [
    `${personas.jerry.voice}`,
    `${personas.greg.voice}`,
    SHARED,
    "Plan the episode. Do not write the dialogue.",
    "Return JSON only, with title, description, and sections.",
    "title is a short hook. It does not include the show name.",
    "description is two sentences a listener could read before pressing play.",
    "sections must use the given ids, in the same order.",
    "Each section has angle, jerry, greg, facts, and handoff.",
    "angle is the football question. jerry is Jerry's stance. greg is Greg's different stance.",
    "facts are short lines copied from that section's sheet. handoff is one line that leads into the next section. The last handoff can be empty.",
    "Every angle, stance, fact, and handoff may use only names and numbers from that section's sheet.",
  ].join("\n\n");
}

export function sectionStyle(): string {
  return [
    `${personas.jerry.voice}`,
    `${personas.greg.voice}`,
    SHARED,
    "Write one section of dialogue between Jerry and Greg.",
    'Return JSON only: {"lines":[{"speaker":"jerry","text":"..."},{"speaker":"greg","text":"..."}]}',
    "speaker is jerry or greg. Both speak. Turns alternate and stay under 120 words.",
    "Jerry argues the jerry stance from the outline. Greg argues the greg stance. Do not swap them.",
    "Use only the sheet for this section, plus a lookup_player result from this draft.",
    "Call lookup_player only for a rostered player whose week points need an explanation the sheet does not give.",
    "A player's points stay the score on the sheet. A lookup cannot replace them.",
    "Hit the word budget. The open welcomes listeners to The Dig with Greg and Jerry. The close names The Dig.",
    "A preview is about a game that has not been played. Do not say either team beat, defeated, or won that game.",
    "The handoff is a note for the next section. Do not read it aloud.",
    "Do not repeat a sentence from the previous lines.",
  ].join("\n\n");
}

export function reviewerStyle(): string {
  return [
    "You audit one section of The Dig. You do not rewrite it.",
    "Jerry Crowe is the hot take. Greg Pell is the calmer counter. Heat stays on the roster or the result.",
    "Flag a line when its speaker breaks that persona, leaves the stance assigned in the outline, aims heat at a person, or invents what the other host said.",
    "Do not flag a line that follows its stance, even when the stance is sharp.",
    'Return JSON only: {"flags":[{"line":0,"reason":"..."}]}. line is the index. Return {"flags":[]} when the section holds.',
  ].join(" ");
}
