export type ColumnCopy = {
  headline: string;
  dek: string;
  paragraphs: string[];
};

export function parseColumn(raw: string): ColumnCopy {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Column was not JSON.");
  let value: unknown;
  try {
    value = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new Error("Column JSON could not be parsed.");
  }
  if (!value || typeof value !== "object") throw new Error("Column JSON was empty.");
  const row = value as { headline?: unknown; dek?: unknown; paragraphs?: unknown };
  if (typeof row.headline !== "string" || typeof row.dek !== "string" || !Array.isArray(row.paragraphs)) {
    throw new Error("Column JSON is missing headline, dek, or paragraphs.");
  }
  const paragraphs = row.paragraphs.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  const headline = row.headline.trim();
  const dek = row.dek.trim();
  if (!headline || !dek || paragraphs.length === 0) throw new Error("Column JSON was empty.");
  return { headline, dek, paragraphs: paragraphs.map((item) => item.trim()) };
}

export function columnProse(copy: ColumnCopy): string {
  return [copy.headline, copy.dek, ...copy.paragraphs].join("\n");
}

export function slugifyColumn(headline: string, week: number, desk: string): string {
  const base = headline
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${base || "column"}-w${week}-${desk}`;
}
