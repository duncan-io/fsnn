export function extractJson(raw: string): unknown {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The response was not JSON.");
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new Error("The response JSON could not be parsed.");
  }
}
