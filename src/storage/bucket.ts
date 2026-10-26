import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let cached: { bucket: string; client: S3Client } | null = null;

function s3() {
  if (cached) return cached;
  const bucket = process.env.S3_BUCKET?.trim();
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3 bucket settings. Add them to .env.local (see .env.example).");
  }
  cached = {
    bucket,
    client: new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: false,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    }),
  };
  return cached;
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const { bucket, client } = s3();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=86400",
    }),
  );
}

export async function putJpeg(key: string, bytes: Uint8Array): Promise<void> {
  await putObject(key, bytes, "image/jpeg");
}

export type RangedObject = {
  bytes: Uint8Array;
  total: number;
  contentRange: string | null;
};

export async function getObjectRange(key: string, range?: string): Promise<RangedObject | null> {
  const { bucket, client } = s3();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: range }));
    if (!object.Body) return null;
    const bytes = await object.Body.transformToByteArray();
    return {
      bytes,
      total: totalSize(object.ContentRange, object.ContentLength, bytes.length),
      contentRange: object.ContentRange ?? null,
    };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export function isUnsatisfiableRange(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && error.name === "InvalidRange") return true;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  return !!metadata && typeof metadata === "object" && "httpStatusCode" in metadata && metadata.httpStatusCode === 416;
}

export async function getJpeg(key: string): Promise<Uint8Array | null> {
  const { bucket, client } = s3();
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) return null;
    return object.Body.transformToByteArray();
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

function totalSize(contentRange: string | undefined, contentLength: number | undefined, bytes: number): number {
  const match = contentRange?.match(/\/(\d+)\s*$/);
  if (match) return Number(match[1]);
  return contentLength ?? bytes;
}

function isMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("name" in error && (error.name === "NoSuchKey" || error.name === "NotFound")) return true;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  return !!metadata && typeof metadata === "object" && "httpStatusCode" in metadata && metadata.httpStatusCode === 404;
}
