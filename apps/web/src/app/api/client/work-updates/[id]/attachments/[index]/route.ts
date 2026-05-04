import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { getClientWorkFileDownloadLink } from "@/lib/client-work-attachment-storage";

type Ctx = { params: Promise<{ id: string; index: string }> };

function normalizeAttachments(raw: unknown): ClientWorkAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as ClientWorkAttachment[];
}

/**
 * Authenticated redirect to a short-lived download URL (S3 presigned or local upload path).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam, index: indexParam } = await ctx.params;
  const workId = Number(idParam);
  const fileIndex = Number(indexParam);
  if (!Number.isFinite(workId) || !Number.isFinite(fileIndex) || fileIndex < 0) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const [row] = await db
    .select()
    .from(schema.clientWorkUpdates)
    .where(
      and(
        eq(schema.clientWorkUpdates.id, workId),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    );

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const attachments = normalizeAttachments(row.attachments);
  const att = attachments[fileIndex];
  if (!att?.storagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await getClientWorkFileDownloadLink(
    att.storagePath,
    req.nextUrl.origin,
    att.mimeType
  );
  if (!link) {
    return NextResponse.json({ error: "Could not prepare download" }, { status: 500 });
  }

  const res = NextResponse.redirect(link.url);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}
