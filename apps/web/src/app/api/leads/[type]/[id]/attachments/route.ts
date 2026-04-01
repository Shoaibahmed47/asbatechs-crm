import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { errorJson, okJson, withObservedRequest } from "@/lib/observability";
import {
  fetchLeadForAttachmentAccess,
  normalizeLeadTypeParam
} from "@/lib/lead-attachment-guard";
import { storeValidatedLeadAttachment } from "@/lib/lead-attachment-storage";
import {
  sanitizeUploadFileName,
  validateSecureUpload
} from "@/lib/secure-upload";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  return withObservedRequest(req, async (ctx) => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;
    if (!payload || !isRole(payload.role)) {
      return errorJson(ctx, 401, "Unauthorized");
    }

    const { id: idParam, type: typeParam } = await context.params;
    const id = Number(idParam);
    const type = normalizeLeadTypeParam(typeParam);
    if (Number.isNaN(id) || !type) {
      return errorJson(ctx, 400, "Invalid id or type");
    }

    const leadRow = await fetchLeadForAttachmentAccess(payload, id, type);
    if (!leadRow) {
      return errorJson(ctx, 404, "Lead not found");
    }

    const attachments = await db
      .select()
      .from(schema.leadAttachments)
      .where(
        and(
          eq(schema.leadAttachments.leadId, id),
          eq(schema.leadAttachments.isDeleted, false)
        )
      )
      .orderBy(desc(schema.leadAttachments.createdAt));

    return okJson(ctx, { attachments });
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  return withObservedRequest(req, async (ctx) => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;
    if (!payload || !isRole(payload.role)) {
      return errorJson(ctx, 401, "Unauthorized");
    }

    const { id: idParam, type: typeParam } = await context.params;
    const id = Number(idParam);
    const type = normalizeLeadTypeParam(typeParam);
    if (Number.isNaN(id) || !type) {
      return errorJson(ctx, 400, "Invalid id or type");
    }

    const leadRow = await fetchLeadForAttachmentAccess(payload, id, type);
    if (!leadRow) {
      return errorJson(ctx, 404, "Lead not found");
    }

    const formData = await req.formData();
    const file = formData.get("file");

    const parseMeta = z.object({
      fileName: z.string().optional(),
      description: z.string().optional()
    });
    const meta = parseMeta.parse({
      fileName: formData.get("fileName"),
      description: formData.get("description")
    });

    if (!(file instanceof File)) {
      return errorJson(ctx, 400, "Missing file");
    }

    const claimedMime = file.type?.trim() ? file.type.trim() : null;
    const sanitizedFileName = sanitizeUploadFileName(meta.fileName ?? file.name);

    const bytes = Buffer.from(await file.arrayBuffer());
    const checked = validateSecureUpload(bytes, claimedMime, sanitizedFileName);
    if (!checked.ok) {
      return errorJson(ctx, checked.status, checked.error);
    }

    const { storagePath } = await storeValidatedLeadAttachment(id, checked.value);

    const [attachment] = await db
      .insert(schema.leadAttachments)
      .values({
        leadId: id,
        fileName: sanitizedFileName,
        mimeType: checked.value.mimeType,
        storagePath
      })
      .returning();

    await logActivity({
      userId: payload.userId,
      action: "lead_attachment_uploaded",
      entityType: "lead_attachment",
      entityId: attachment.id
    });

    return okJson(ctx, { attachment }, 201);
  });
}
