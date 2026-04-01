import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { promises as fs } from "fs";
import {
  buildObjectStorageKey,
  type ValidatedUpload
} from "@/lib/secure-upload";

const S3_STORAGE_PREFIX = "s3:";

/**
 * Object storage layout (Next.js / Node):
 *
 * - **Production**: Set `S3_BUCKET`, `S3_REGION`, and credentials (or use the default provider chain on AWS).
 *   Objects are private; downloads use short-lived signed URLs only (see `getLeadAttachmentDownloadUrl`).
 * - **Local dev**: If `S3_BUCKET` is unset, files go under `public/uploads/leads/{leadId}/…` (legacy behavior).
 *
 * Security notes:
 * - SSE-S3 (`AES256`) encrypts blobs at rest in S3.
 * - Do not enable public ACLs or public bucket policies for attachments.
 * - Prefer IAM roles in AWS over long-lived access keys where possible.
 */

function getS3BucketConfig(): { bucket: string; region: string; endpoint?: string } | null {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    return null;
  }
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
      /**
       * When `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` are omitted, the SDK uses the
       * default credential provider chain (env, shared config, ECS task role, etc.).
       */
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
  if (!isS3StoragePath(storagePath)) {
    return null;
  }
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
      /**
       * Server-side encryption at rest (SSE-S3). For stricter policies use SSE-KMS + CMK.
       */
      ServerSideEncryption: "AES256"
    })
  );
}

/**
 * Persist validated bytes either to S3 (when configured) or to local `public/uploads`.
 */
export async function storeValidatedLeadAttachment(
  leadId: number,
  upload: ValidatedUpload
): Promise<{ storagePath: string }> {
  const key = buildObjectStorageKey(leadId, upload.sanitizedFileName);
  const s3cfg = getS3BucketConfig();

  if (s3cfg) {
    await putS3Object({
      key,
      body: upload.buffer,
      contentType: upload.mimeType
    });
    /** Prefix lets the app route reads to S3 without exposing bucket name in the browser DB row. */
    return { storagePath: `${S3_STORAGE_PREFIX}${key}` };
  }

  const fileNameOnly = key.split("/").pop()!;
  const storageDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "leads",
    String(leadId)
  );
  await fs.mkdir(storageDir, { recursive: true });
  const fullPath = path.join(storageDir, fileNameOnly);
  /**
   * Filename is entirely server-generated (`uuid-sanitized.ext`); `fileNameOnly` has no `..` segments.
   */
  await fs.writeFile(fullPath, upload.buffer);
  return { storagePath: `/uploads/leads/${leadId}/${fileNameOnly}` };
}

export type DownloadLinkResult =
  | { kind: "s3"; url: string; expiresInSeconds: number }
  | { kind: "local"; url: string };

/**
 * Returns a time-limited signed HTTPS URL for S3, or an app-origin URL for legacy local files.
 */
export async function getLeadAttachmentDownloadLink(
  storagePath: string,
  reqOrigin: string,
  contentTypeHint?: string | null
): Promise<DownloadLinkResult | null> {
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
