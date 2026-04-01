import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { errorJson, okJson, withObservedRequest } from "@/lib/observability";
import {
  fetchLeadForAttachmentAccess,
  normalizeLeadTypeParam
} from "@/lib/lead-attachment-guard";
import { getLeadAttachmentDownloadLink } from "@/lib/lead-attachment-storage";

/**
 * Mint a short-lived download URL without making the bucket public.
 * - S3: HTTPS presigned GET URL (TTL from `S3_SIGNED_URL_TTL_SECONDS`, default 300s).
 * - Local dev: absolute URL under the same origin (legacy `public/uploads` only).
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string; attachmentId: string }> }
) {
  return withObservedRequest(req, async (ctx) => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;
    if (!payload || !isRole(payload.role)) {
      return errorJson(ctx, 401, "Unauthorized");
    }

    const { id: idParam, type: typeParam, attachmentId: attachmentIdParam } =
      await context.params;
    const leadId = Number(idParam);
    const type = normalizeLeadTypeParam(typeParam);
    const attachmentId = Number(attachmentIdParam);
    if (Number.isNaN(leadId) || !type || Number.isNaN(attachmentId)) {
      return errorJson(ctx, 400, "Invalid parameters");
    }

    const leadRow = await fetchLeadForAttachmentAccess(payload, leadId, type);
    if (!leadRow) {
      return errorJson(ctx, 404, "Not found");
    }

    const [att] = await db
      .select()
      .from(schema.leadAttachments)
      .where(
        and(
          eq(schema.leadAttachments.id, attachmentId),
          eq(schema.leadAttachments.leadId, leadId),
          eq(schema.leadAttachments.isDeleted, false)
        )
      );

    if (!att) {
      return errorJson(ctx, 404, "Attachment not found");
    }

    const link = await getLeadAttachmentDownloadLink(
      att.storagePath,
      req.nextUrl.origin,
      att.mimeType
    );
    if (!link) {
      return errorJson(ctx, 500, "Could not generate download link for this attachment");
    }

    if (link.kind === "s3") {
      return okJson(ctx, {
        downloadUrl: link.url,
        expiresInSeconds: link.expiresInSeconds,
        storage: "s3" as const
      });
    }

    return okJson(ctx, {
      downloadUrl: link.url,
      expiresInSeconds: null,
      storage: "local" as const
    });
  });
}
