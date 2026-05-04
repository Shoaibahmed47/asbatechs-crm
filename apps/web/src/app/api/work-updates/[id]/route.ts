import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import {
  CLIENT_WORK_MAX_UPLOAD_BYTES,
  sanitizeUploadFileName,
  validateSecureUpload
} from "@/lib/secure-upload";
import {
  deleteClientWorkFile,
  storeValidatedClientWorkFile
} from "@/lib/client-work-attachment-storage";

const MAX_WORK_FILES = 10;
type Ctx = { params: Promise<{ id: string }> };

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [existing] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      clientId: schema.clientWorkUpdates.clientId,
      projectId: schema.clientWorkUpdates.projectId,
      attachments: schema.clientWorkUpdates.attachments
    })
    .from(schema.clientWorkUpdates)
    .where(eq(schema.clientWorkUpdates.id, id));
  if (!existing) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const isEmployee = payload.role === "employee";
  if (isEmployee) {
    const [assignment] = await db
      .select({ projectId: schema.employeeClientProjectAssignments.projectId })
      .from(schema.employeeClientProjectAssignments)
      .where(
        and(
          eq(schema.employeeClientProjectAssignments.userId, payload.userId),
          eq(schema.employeeClientProjectAssignments.projectId, existing.projectId ?? -1)
        )
      );
    if (!assignment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 300) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const clientId = Number(formData.get("clientId"));
  const projectIdRaw = formData.get("projectId");
  const projectId =
    projectIdRaw == null || String(projectIdRaw).trim() === "" ? null : Number(projectIdRaw);
  if (!Number.isFinite(clientId) || (projectId != null && !Number.isFinite(projectId))) {
    return NextResponse.json({ error: "Invalid client/project" }, { status: 400 });
  }

  if (isEmployee) {
    if (projectId == null) {
      return NextResponse.json({ error: "Project is required" }, { status: 400 });
    }
    const [assignment] = await db
      .select({
        projectId: schema.employeeClientProjectAssignments.projectId,
        clientId: schema.employeeClientProjectAssignments.clientId
      })
      .from(schema.employeeClientProjectAssignments)
      .where(
        and(
          eq(schema.employeeClientProjectAssignments.userId, payload.userId),
          eq(schema.employeeClientProjectAssignments.projectId, projectId)
        )
      );
    if (!assignment || assignment.clientId !== clientId) {
      return NextResponse.json({ error: "Project is not assigned to this employee" }, { status: 403 });
    }
  }

  const notesRaw = formData.get("notes");
  const notes =
    notesRaw == null || String(notesRaw).trim() === ""
      ? null
      : String(notesRaw).trim().slice(0, 8000);
  const gitRepoUrl = emptyToNull(String(formData.get("gitRepoUrl") ?? "").trim().slice(0, 2000));

  const currentAttachments = (existing.attachments ?? []) as ClientWorkAttachment[];
  const removeAttachmentPaths = new Set(
    formData
      .getAll("removeAttachmentPaths")
      .map((value) => String(value || "").trim())
      .filter((value) => value.length > 0)
  );
  const removedAttachments = currentAttachments.filter((att) =>
    removeAttachmentPaths.has(att.storagePath)
  );
  const keptAttachments = currentAttachments.filter(
    (att) => !removeAttachmentPaths.has(att.storagePath)
  );
  const files = formData
    .getAll("files")
    .filter((x): x is File => typeof File !== "undefined" && x instanceof File && x.size > 0);

  if (keptAttachments.length + files.length > MAX_WORK_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_WORK_FILES})` }, { status: 400 });
  }

  const nextAttachments = [...keptAttachments];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const name = sanitizeUploadFileName(file.name);
    const checked = validateSecureUpload(buf, file.type || null, name, {
      maxBytes: CLIENT_WORK_MAX_UPLOAD_BYTES
    });
    if (!checked.ok) {
      return NextResponse.json({ error: checked.error }, { status: checked.status });
    }
    const { storagePath } = await storeValidatedClientWorkFile(clientId, id, checked.value);
    nextAttachments.push({
      fileName: checked.value.sanitizedFileName,
      storagePath,
      mimeType: checked.value.mimeType
    });
  }

  const [updated] = await db
    .update(schema.clientWorkUpdates)
    .set({
      clientId,
      projectId,
      title,
      notes,
      gitRepoUrl,
      attachments: nextAttachments,
      updatedAt: new Date()
    })
    .where(eq(schema.clientWorkUpdates.id, id))
    .returning();

  for (const att of removedAttachments) {
    await deleteClientWorkFile(att.storagePath).catch(() => null);
  }

  return NextResponse.json({ update: updated });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number((await ctx.params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [existing] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      projectId: schema.clientWorkUpdates.projectId,
      attachments: schema.clientWorkUpdates.attachments
    })
    .from(schema.clientWorkUpdates)
    .where(eq(schema.clientWorkUpdates.id, id));

  if (!existing) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const isEmployee = payload.role === "employee";
  if (isEmployee) {
    const [assignment] = await db
      .select({ projectId: schema.employeeClientProjectAssignments.projectId })
      .from(schema.employeeClientProjectAssignments)
      .where(
        and(
          eq(schema.employeeClientProjectAssignments.userId, payload.userId),
          eq(schema.employeeClientProjectAssignments.projectId, existing.projectId ?? -1)
        )
      );
    if (!assignment) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const attachments = (existing.attachments ?? []) as ClientWorkAttachment[];
  await db.delete(schema.clientWorkUpdates).where(eq(schema.clientWorkUpdates.id, id));

  for (const att of attachments) {
    await deleteClientWorkFile(att.storagePath).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}
