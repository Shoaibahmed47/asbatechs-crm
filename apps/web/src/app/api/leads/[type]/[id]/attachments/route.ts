import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import path from "path";
import { promises as fs } from "fs";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

function normalizeType(typeParam: string): "hot" | "sale" | null {
  if (typeParam === "hot") return "hot";
  if (typeParam === "sales" || typeParam === "sale") return "sale";
  return null;
}

const allowedMime = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml"
]);

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam, type: typeParam } = await context.params;
  const id = Number(idParam);
  const type = normalizeType(typeParam);
  if (Number.isNaN(id) || !type) {
    return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
  }

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.id, id),
        eq(schema.leads.type, type),
        eq(schema.leads.isDeleted, false)
      )
    );

  if (!leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "employee") {
    if (leadRow.assignedUserId !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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

  return NextResponse.json({ attachments });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idParam, type: typeParam } = await context.params;
  const id = Number(idParam);
  const type = normalizeType(typeParam);
  if (Number.isNaN(id) || !type) {
    return NextResponse.json({ error: "Invalid id or type" }, { status: 400 });
  }

  const [leadRow] = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.id, id),
        eq(schema.leads.type, type),
        eq(schema.leads.isDeleted, false)
      )
    );

  if (!leadRow) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (payload.role === "employee") {
    if (leadRow.assignedUserId !== payload.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (payload.role === "manager") {
    if (!payload.departmentId || leadRow.departmentId !== payload.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  // Basic size guard: 10 MB max.
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const mimeType = file.type || null;
  const fileName = sanitizeFileName(meta.fileName ?? file.name);

  // MIME checks (client-provided MIME can be wrong, but this is a reasonable safeguard).
  if (mimeType && !allowedMime.has(mimeType)) {
    return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
  }

  const storageFileName = `${Date.now()}-${fileName}`;
  const storageDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "leads",
    String(id)
  );
  await fs.mkdir(storageDir, { recursive: true });

  const storageFilePath = path.join(storageDir, storageFileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(storageFilePath, bytes);

  const storagePath = `/uploads/leads/${id}/${storageFileName}`;

  const [attachment] = await db
    .insert(schema.leadAttachments)
    .values({
      leadId: id,
      fileName,
      mimeType,
      storagePath
    })
    .returning();

  await logActivity({
    userId: payload.userId,
    action: "lead_attachment_uploaded",
    entityType: "lead_attachment",
    entityId: attachment.id
  });

  return NextResponse.json({ attachment }, { status: 201 });
}

