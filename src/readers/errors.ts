const unreachableCodes = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

export function isUnreachableDatabase(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ("code" in current && typeof current.code === "string" && unreachableCodes.has(current.code)) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export function violationName(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const row = current as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    const unique = row.code === "23505" || (row.message ?? "").includes("duplicate key");
    if (unique) return row.constraint_name ?? row.constraint ?? row.message ?? "unique";
    current = row.cause;
  }
  return null;
}
