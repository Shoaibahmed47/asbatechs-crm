import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { promises as fs } from "fs";
import {
  buildClientWorkStorageKey,
  type ValidatedUpload
} from "@/lib/secure-upload";

const S3_STORAGE_PREFIX = "s3:";

function getS3BucketConfig(): { bucket: string; region: string; endpoint?: string } | null {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) return null;
  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  return { bucket, region, endpoint };
}

let s3Client: S3Client | null = null;

function getOrCreateS3Client(cfg: { region: string; endpoint?: string }): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === "1" ||
        process.env.S3_FORCE_PATH_STYLE === "true",
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
          : undefined
    });
  }
  return s3Client;
}

export function isS3StoragePath(storagePath: string): boolean {
  return storagePath.startsWith(S3_STORAGE_PREFIX);
}

export function getS3ObjectKey(storagePath: string): string | null {
  if (!isS3StoragePath(storagePath)) return null;
  return storagePath.slice(S3_STORAGE_PREFIX.length);
}

function signedUrlTtlSeconds(): number {
  const n = Number(process.env.S3_SIGNED_URL_TTL_SECONDS);
  return n > 0 && n <= 3600 ? n : 300;
}

async function putS3Object(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  const cfg = getS3BucketConfig()!;
  const client = getOrCreateS3Client({ region: cfg.region, endpoint: cfg.endpoint });
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      ServerSideEncryption: "AES256"
    })
  );
}

export async function storeValidatedClientWorkFile(
  clientId: number,
  workUpdateId: number,
  upload: ValidatedUpload
): Promise<{ storagePath: string }> {
  const key = buildClientWorkStorageKey(clientId, workUpdateId, upload.sanitizedFileName);
  const s3cfg = getS3BucketConfig();

  if (s3cfg) {
    await putS3Object({
      key,
      body: upload.buffer,
      contentType: upload.mimeType
    });
    return { storagePath: `${S3_STORAGE_PREFIX}${key}` };
  }

  const fileNameOnly = key.split("/").pop()!;
  const storageDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "clients",
    String(clientId),
    "work",
    String(workUpdateId)
  );
  await fs.mkdir(storageDir, { recursive: true });
  const fullPath = path.join(storageDir, fileNameOnly);
  await fs.writeFile(fullPath, upload.buffer);
  return {
    storagePath: `/uploads/clients/${clientId}/work/${workUpdateId}/${fileNameOnly}`
  };
}

export type ClientWorkDownloadResult =
  | { kind: "s3"; url: string; expiresInSeconds: number }
  | { kind: "local"; url: string };

export async function getClientWorkFileDownloadLink(
  storagePath: string,
  reqOrigin: string,
  contentTypeHint?: string | null
): Promise<ClientWorkDownloadResult | null> {
  const s3cfg = getS3BucketConfig();
  const key = getS3ObjectKey(storagePath);

  if (key && s3cfg) {
    const client = getOrCreateS3Client({ region: s3cfg.region, endpoint: s3cfg.endpoint });
    const cmd = new GetObjectCommand({
      Bucket: s3cfg.bucket,
      Key: key,
      ...(contentTypeHint ? { ResponseContentType: contentTypeHint } : {})
    });
    const expiresIn = signedUrlTtlSeconds();
    const url = await getSignedUrl(client, cmd, { expiresIn });
    return { kind: "s3", url, expiresInSeconds: expiresIn };
  }

  if (storagePath.startsWith("/uploads/")) {
    const url = `${reqOrigin.replace(/\/$/, "")}${storagePath}`;
    return { kind: "local", url };
  }

  return null;
}

export async function deleteClientWorkFile(storagePath: string): Promise<void> {
  const s3cfg = getS3BucketConfig();
  const key = getS3ObjectKey(storagePath);
  if (key && s3cfg) {
    const client = getOrCreateS3Client({ region: s3cfg.region, endpoint: s3cfg.endpoint });
    await client.send(
      new DeleteObjectCommand({
        Bucket: s3cfg.bucket,
        Key: key
      })
    );
    return;
  }

  if (storagePath.startsWith("/uploads/")) {
    const relativePath = storagePath.replace(/^\/+/, "").replace(/\//g, path.sep);
    const fullPath = path.join(process.cwd(), "public", relativePath);
    await fs.unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
      if (err?.code !== "ENOENT") throw err;
    });
  }
}
