const URL = "https://google.serper.dev/search";

export type SearchHit = {
  title: string;
  link: string;
  snippet: string;
};

export function serperKey(): string | null {
  const key = process.env.SERPER_API_KEY?.trim();
  return key ? key : null;
}

export function sanitizeSerper(body: string) {
  return body.replace(/[A-Za-z0-9_-]{20,}/g, "[key]").replace(/\s+/g, " ").trim().slice(0, 180);
}

export async function search(query: string, complete: typeof fetch = fetch): Promise<SearchHit[]> {
  const key = serperKey();
  if (!key) throw new Error("Missing SERPER_API_KEY. Add it to .env.local (see .env.example).");
  const response = await complete(URL, {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`Serper request failed (${response.status}): ${sanitizeSerper(raw)}`);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("Serper returned a response that was not JSON.");
  }
  const organic = payload && typeof payload === "object" && "organic" in payload ? payload.organic : null;
  if (!Array.isArray(organic)) return [];
  return organic.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { title?: unknown; link?: unknown; snippet?: unknown };
    if (typeof row.title !== "string" || typeof row.snippet !== "string") return [];
    return [{ title: row.title, link: typeof row.link === "string" ? row.link : "", snippet: row.snippet }];
  });
}
