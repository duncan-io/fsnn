import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let sql: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Use the FSNN Postgres public URL from Railway, with ?sslmode=require.",
    );
  }
  return url;
}

export function getDb() {
  if (!database || !sql) {
    sql = postgres(databaseUrl(), { max: 5 });
    database = drizzle(sql, { schema });
  }
  return database;
}

export async function closeDb() {
  if (!sql) return;
  const current = sql;
  sql = null;
  database = null;
  await current.end({ timeout: 5 });
}
