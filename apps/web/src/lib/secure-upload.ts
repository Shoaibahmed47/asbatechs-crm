import { randomUUID } from "crypto";

/**
 * Lead attachment upload limits and policy.
 * Tune via env when deploying (avoid hard-coding secrets; these are non-secret defaults).
 */
export const DEFAULT_MAX_UPLOAD_BYTES =
  Number(process.env.SECURE_UPLOAD_MAX_BYTES) > 0
    ? Number(process.env.SECURE_UPLOAD_MAX_BYTES)
    : 10 * 1024 * 1024; // 10 MB

/**
 * Allowed media types after validation.
 * SVG is restricted with content inspection (see assertSafeSvg) because it can embed scripts.
 */
export const ALLOWED_UPLOAD_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml"
]);

/**
 * Strip path segments, Unicode-normalize, and allow only a conservative character set so the
 * stored name cannot contain `../`, backslashes, control chars, or HTML/JS delimiters.
 */
export function sanitizeUploadFileName(raw: string): string {
  const base = raw.split(/[/\\]/u).pop()?.trim() ?? "file";
  let s = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/gu, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
  s = s.replace(/^\.+/, "");
  const max = 180;
  if (s.length > max) {
    const extIdx = s.lastIndexOf(".");
    const ext = extIdx > 0 ? s.slice(extIdx) : "";
    const stem = extIdx > 0 ? s.slice(0, extIdx) : s;
    s = stem.slice(0, Math.max(1, max - ext.length)) + ext;
  }
  if (!s || s === "." || s === "..") {
    return "file";
  }
  return s;
}

/**
 * Server-side object key: UUID prefix prevents guessability and overwrites; path never trusts user segments.
 */
export function buildObjectStorageKey(leadId: number, sanitizedFileName: string): string {
  return `leads/${leadId}/${randomUUID()}-${sanitizedFileName}`;
}

function readAscii(buf: Buffer, len: number): string {
  return buf.subarray(0, len).toString("ascii");
}

/**
 * Sniff a small prefix of the file to detect real type. Mitre: client-supplied Content-Type is untrusted.
 */
export function detectMimeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  // PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf";
  }
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  // GIF
  const gif = readAscii(buf, 6);
  if (gif === "GIF87a" || gif === "GIF89a") {
    return "image/gif";
  }
  // WEBP (RIFF....WEBP)
  if (
    readAscii(buf, 4) === "RIFF" &&
    buf.length >= 12 &&
    readAscii(buf.subarray(8, 12), 4) === "WEBP"
  ) {
    return "image/webp";
  }
  // SVG (text): must start like XML/SVG after optional BOM/whitespace
  const text = buf
    .subarray(0, Math.min(buf.length, 8192))
    .toString("utf8")
    .trimStart();
  if (/^(<\?xml|<svg\b)/i.test(text)) {
    return "image/svg+xml";
  }
  return null;
}

/**
 * Block obvious script vectors in SVG uploads. This is defense-in-depth; serve SVG with
 * Content-Disposition: attachment if you expose downloads, and use CSP on your app.
 */
export function assertSafeSvg(svgUtf8: string): boolean {
  const lower = svgUtf8.toLowerCase();
  if (/<script\b/i.test(svgUtf8)) return false;
  if (/javascript:/i.test(svgUtf8)) return false;
  if (/\bon[a-z]+\s*=/i.test(svgUtf8)) return false;
  if (lower.includes("<foreignobject")) return false;
  return true;
}

export type ValidatedUpload = {
  buffer: Buffer;
  /** Canonical MIME to store (from magic bytes, or reconciled with client hint). */
  mimeType: string;
  sanitizedFileName: string;
};

/**
 * Validates size, file magic bytes vs claimed MIME, and allowed type set.
 */
export function validateSecureUpload(
  buffer: Buffer,
  claimedMime: string | null,
  sanitizedFileName: string
): { ok: true; value: ValidatedUpload } | { ok: false; status: number; error: string } {
  if (buffer.length > DEFAULT_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 400,
      error: `File too large (max ${Math.floor(DEFAULT_MAX_UPLOAD_BYTES / (1024 * 1024))}MB)`
    };
  }
  if (buffer.length === 0) {
    return { ok: false, status: 400, error: "Empty file" };
  }

  if (claimedMime && !ALLOWED_UPLOAD_MIME.has(claimedMime)) {
    return { ok: false, status: 400, error: "Unsupported declared file type" };
  }

  const detected = detectMimeFromBuffer(buffer);
  if (!detected || !ALLOWED_UPLOAD_MIME.has(detected)) {
    return { ok: false, status: 400, error: "Unsupported or unreadable file type" };
  }

  if (claimedMime && claimedMime !== detected && ALLOWED_UPLOAD_MIME.has(claimedMime)) {
    return {
      ok: false,
      status: 400,
      error: "File content does not match declared type (possible spoofing)"
    };
  }

  if (detected === "image/svg+xml") {
    const svgText = buffer.toString("utf8");
    if (!assertSafeSvg(svgText)) {
      return {
        ok: false,
        status: 400,
        error: "SVG contains disallowed content (scripts or inline handlers)"
      };
    }
  }

  return {
    ok: true,
    value: {
      buffer,
      mimeType: detected,
      sanitizedFileName
    }
  };
}
