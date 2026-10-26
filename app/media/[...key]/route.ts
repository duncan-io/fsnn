import { connection } from "next/server";
import { imageKeyFromPath } from "@/src/images/key";
import { getJpeg } from "@/src/storage/bucket";

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  await connection();
  const { key } = await context.params;
  const imageKey = imageKeyFromPath(key);
  if (!imageKey) return new Response(null, { status: 404 });

  try {
    const bytes = await getJpeg(imageKey);
    if (!bytes) return new Response(null, { status: 404 });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return new Response(null, { status: 500 });
  }
}
