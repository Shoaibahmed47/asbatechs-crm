import { headers } from "next/headers";

/**
 * Absolute origin for minting download URLs in server components (S3 presign / local uploads).
 */
export async function getClientPortalRequestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`;
  }
  const app = process.env.APP_URL?.trim().replace(/\/$/, "");
  return app && app.length > 0 ? app : "http://localhost:3000";
}
