const ZONE = "America/New_York";

const SLOTS = {
  results: { days: 1, hour: 9 },
  recap: { days: 1, hour: 10 },
  rankings: { days: 2, hour: 10 },
  waivers: { days: 4, hour: 9 },
} as const;

export type SlotPiece = keyof typeof SLOTS;

export function slotFor(weekEnd: string, piece: SlotPiece): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekEnd);
  if (!match) throw new Error(`Week end date is not a calendar day: ${weekEnd}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const slot = SLOTS[piece];
  return zonedDate(year, month, day + slot.days, slot.hour, ZONE);
}

function zonedDate(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
  const first = zoneOffsetMinutes(guess, timeZone);
  let result = new Date(guess.getTime() - first * 60_000);
  const second = zoneOffsetMinutes(result, timeZone);
  if (second !== first) result = new Date(guess.getTime() - second * 60_000);
  return result;
}

function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}
