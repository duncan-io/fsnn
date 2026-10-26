import { connection } from "next/server";
import { audioKeyFromPath } from "@/src/podcast/key";
import { getObjectRange, isUnsatisfiableRange } from "@/src/storage/bucket";

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  await connection();
  const { key } = await context.params;
  const audioKey = audioKeyFromPath(key);
  if (!audioKey) return new Response(null, { status: 404 });

  const range = request.headers.get("range");
  if (range && !/^bytes=\d*-\d*$/.test(range)) {
    return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes" } });
  }

  try {
    const object = await getObjectRange(audioKey, range ?? undefined);
    if (!object) return new Response(null, { status: 404 });
    const headers = new Headers({
      "Content-Type": "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
      "Content-Length": String(object.bytes.length),
    });
    if (!range) return new Response(Buffer.from(object.bytes), { status: 200, headers });
    headers.set("Content-Range", object.contentRange ?? `bytes 0-${Math.max(0, object.bytes.length - 1)}/${object.total}`);
    return new Response(Buffer.from(object.bytes), { status: 206, headers });
  } catch (error) {
    if (isUnsatisfiableRange(error)) {
      return new Response(null, { status: 416, headers: { "Accept-Ranges": "bytes" } });
    }
    console.error(error instanceof Error ? error.message : error);
    return new Response(null, { status: 500 });
  }
}
