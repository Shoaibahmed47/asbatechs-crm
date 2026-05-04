import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";
import {
  CLIENT_WORK_MAX_UPLOAD_BYTES,
  sanitizeUploadFileName,
  validateSecureUpload
} from "@/lib/secure-upload";
import {
  deleteClientWorkFile,
  storeValidatedClientWorkFile
} from "@/lib/client-work-attachment-storage";

const optionalGit = z.string().max(2000).nullable().optional();

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(8000).nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  gitRepoUrl: optionalGit,
  attachments: z
    .array(
      z.object({
        fileName: z.string().min(1).max(300),
        storagePath: z.string().min(1).max(2000),
        mimeType: z.string().min(1).max(200)
      })
    )
    .max(10)
    .optional()
});

function emptyToNull(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return s;
}

type Ctx = { params: Promise<{ id: string }> };
const MAX_WORK_FILES = 10;

function parseAttachmentsLike(raw: unknown): ClientWorkAttachment[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: ClientWorkAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const rec = item as Record<string, unknown>;
    if (
      typeof rec.fileName !== "string" ||
      typeof rec.storagePath !== "string" ||
      typeof rec.mimeType !== "string"
    ) {
      return null;
    }
    parsed.push({
      fileName: rec.fileName,
      storagePath: rec.storagePath,
      mimeType: rec.mimeType
    });
  }
  return parsed;
}

async function applyAttachmentChanges(params: {
  existing: ClientWorkAttachment[];
  requested: ClientWorkAttachment[] | undefined;
  filesToAdd: File[];
  clientId: number;
  workUpdateId: number;
}): Promise<{ ok: true; attachments: ClientWorkAttachment[] } | { ok: false; error: string; status: number }> {
  const existingByPath = new Map(params.existing.map((a) => [a.storagePath, a] as const));
  const requestedPaths = new Set<string>();
  const kept: ClientWorkAttachment[] = [];

  if (params.requested !== undefined) {
    for (const attachment of params.requested) {
      const matched = existingByPath.get(attachment.storagePath);
      if (
        !matched ||
        matched.fileName !== attachment.fileName ||
        matched.mimeType !== attachment.mimeType
      ) {
        return { ok: false, error: "Invalid attachments list", status: 400 };
      }
      if (requestedPaths.has(attachment.storagePath)) continue;
      requestedPaths.add(attachment.storagePath);
      kept.push(matched);
    }
  } else {
    kept.push(...params.existing);
    for (const item of params.existing) requestedPaths.add(item.storagePath);
  }

  const combinedCount = kept.length + params.filesToAdd.length;
  if (combinedCount > MAX_WORK_FILES) {
    return { ok: false, error: `Too many files (max ${MAX_WORK_FILES})`, status: 400 };
  }

  const added: ClientWorkAttachment[] = [];
  for (const file of params.filesToAdd) {
    const buf = Buffer.from(await file.arrayBuffer());
    const checked = validateSecureUpload(buf, file.type || null, sanitizeUploadFileName(file.name), {
      maxBytes: CLIENT_WORK_MAX_UPLOAD_BYTES
    });
    if (!checked.ok) {
      return { ok: false, error: checked.error, status: checked.status };
    }
    const { storagePath } = await storeValidatedClientWorkFile(
      params.clientId,
      params.workUpdateId,
      checked.value
    );
    added.push({
      fileName: checked.value.sanitizedFileName,
      storagePath,
      mimeType: checked.value.mimeType
    });
  }

  const removed = params.existing.filter((a) => !requestedPaths.has(a.storagePath));
  for (const attachment of removed) {
    await deleteClientWorkFile(attachment.storagePath).catch(() => undefined);
  }

  return { ok: true, attachments: [...kept, ...added] };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(schema.clientWorkUpdates)
    .where(
      and(
        eq(schema.clientWorkUpdates.id, id),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ctype = req.headers.get("content-type") ?? "";
  let parsedData: z.infer<typeof patchSchema>;
  let filesToAdd: File[] = [];

  if (ctype.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const rawPayload = formData.get("payload");
    let payload: unknown = {};
    if (rawPayload) {
      try {
        payload = JSON.parse(String(rawPayload));
      } catch {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
      }
    }
    const parsed = patchSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    parsedData = parsed.data;
    filesToAdd = formData
      .getAll("files")
      .filter((x): x is File => typeof File !== "undefined" && x instanceof File && x.size > 0);
  } else {
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    parsedData = parsed.data;
  }

  let projectId = existing.projectId;
  if (parsedData.projectId !== undefined) {
    projectId = parsedData.projectId;
    if (projectId != null) {
      const [owned] = await db
        .select({ id: schema.clientProjects.id })
        .from(schema.clientProjects)
        .where(
          and(
            eq(schema.clientProjects.id, projectId),
            eq(schema.clientProjects.clientId, session.clientId)
          )
        );
      if (!owned) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsedData.title != null) updates.title = parsedData.title;
  if (parsedData.notes !== undefined) updates.notes = parsedData.notes;
  if (parsedData.projectId !== undefined) updates.projectId = projectId;
  if (parsedData.gitRepoUrl !== undefined) {
    updates.gitRepoUrl = emptyToNull(parsedData.gitRepoUrl);
  }
  if (parsedData.attachments !== undefined || filesToAdd.length > 0) {
    const existingAttachments = parseAttachmentsLike(existing.attachments) ?? [];
    const attachmentResult = await applyAttachmentChanges({
      existing: existingAttachments,
      requested: parsedData.attachments,
      filesToAdd,
      clientId: session.clientId,
      workUpdateId: id
    });
    if (!attachmentResult.ok) {
      return NextResponse.json({ error: attachmentResult.error }, { status: attachmentResult.status });
    }
    updates.attachments = attachmentResult.attachments;
  }

  const [row] = await db
    .update(schema.clientWorkUpdates)
    .set(updates as any)
    .where(eq(schema.clientWorkUpdates.id, id))
    .returning();

  return NextResponse.json({ update: row });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const deleted = await db
    .delete(schema.clientWorkUpdates)
    .where(
      and(
        eq(schema.clientWorkUpdates.id, id),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    )
    .returning({ id: schema.clientWorkUpdates.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
