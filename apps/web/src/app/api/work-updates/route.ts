import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import {
  CLIENT_WORK_MAX_UPLOAD_BYTES,
  sanitizeUploadFileName,
  validateSecureUpload
} from "@/lib/secure-upload";
import { storeValidatedClientWorkFile } from "@/lib/client-work-attachment-storage";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  projectId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(300),
  notes: z.string().max(8000).nullable().optional(),
  gitRepoUrl: z.string().max(2000).nullable().optional()
});

const MAX_WORK_FILES = 10;

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (payload.role === "employee") {
    const assignments = await db
      .select({
        projectId: schema.employeeClientProjectAssignments.projectId,
        projectName: schema.clientProjects.name,
        clientId: schema.employeeClientProjectAssignments.clientId,
        clientName: schema.clients.name
      })
      .from(schema.employeeClientProjectAssignments)
      .innerJoin(
        schema.clientProjects,
        eq(schema.employeeClientProjectAssignments.projectId, schema.clientProjects.id)
      )
      .innerJoin(
        schema.clients,
        eq(schema.employeeClientProjectAssignments.clientId, schema.clients.id)
      )
      .where(eq(schema.employeeClientProjectAssignments.userId, payload.userId));

    if (assignments.length === 0) {
      return NextResponse.json({
        updates: [],
        clients: [],
        projects: [],
        isAssignmentRestricted: true
      });
    }

    const assignedProjectIds = assignments.map((a) => a.projectId);
    const updates = await db
      .select({
        id: schema.clientWorkUpdates.id,
        title: schema.clientWorkUpdates.title,
        notes: schema.clientWorkUpdates.notes,
        status: schema.clientWorkUpdates.status,
        gitRepoUrl: schema.clientWorkUpdates.gitRepoUrl,
        projectId: schema.clientWorkUpdates.projectId,
        attachments: schema.clientWorkUpdates.attachments,
        createdAt: schema.clientWorkUpdates.createdAt,
        updatedAt: schema.clientWorkUpdates.updatedAt,
        clientId: schema.clientWorkUpdates.clientId,
        clientName: schema.clients.name,
        projectName: schema.clientProjects.name
      })
      .from(schema.clientWorkUpdates)
      .leftJoin(schema.clients, eq(schema.clientWorkUpdates.clientId, schema.clients.id))
      .leftJoin(
        schema.clientProjects,
        eq(schema.clientWorkUpdates.projectId, schema.clientProjects.id)
      )
      .where(inArray(schema.clientWorkUpdates.projectId, assignedProjectIds))
      .orderBy(desc(schema.clientWorkUpdates.createdAt));

    const clientById = new Map<number, { id: number; name: string }>();
    for (const a of assignments) {
      if (!clientById.has(a.clientId)) {
        clientById.set(a.clientId, { id: a.clientId, name: a.clientName });
      }
    }

    return NextResponse.json({
      updates,
      clients: Array.from(clientById.values()).sort((a, b) => a.name.localeCompare(b.name)),
      projects: assignments
        .map((a) => ({
          id: a.projectId,
          clientId: a.clientId,
          name: a.projectName
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      isAssignmentRestricted: true
    });
  }

  const updates = await db
    .select({
      id: schema.clientWorkUpdates.id,
      title: schema.clientWorkUpdates.title,
      notes: schema.clientWorkUpdates.notes,
      status: schema.clientWorkUpdates.status,
      gitRepoUrl: schema.clientWorkUpdates.gitRepoUrl,
      projectId: schema.clientWorkUpdates.projectId,
      attachments: schema.clientWorkUpdates.attachments,
      createdAt: schema.clientWorkUpdates.createdAt,
      updatedAt: schema.clientWorkUpdates.updatedAt,
      clientId: schema.clientWorkUpdates.clientId,
      clientName: schema.clients.name,
      projectName: schema.clientProjects.name
    })
    .from(schema.clientWorkUpdates)
    .leftJoin(schema.clients, eq(schema.clientWorkUpdates.clientId, schema.clients.id))
    .leftJoin(schema.clientProjects, eq(schema.clientWorkUpdates.projectId, schema.clientProjects.id))
    .orderBy(desc(schema.clientWorkUpdates.createdAt));

  const clients = await db
    .select({
      id: schema.clients.id,
      name: schema.clients.name
    })
    .from(schema.clients)
    .orderBy(asc(schema.clients.name));

  const projects = await db
    .select({
      id: schema.clientProjects.id,
      clientId: schema.clientProjects.clientId,
      name: schema.clientProjects.name
    })
    .from(schema.clientProjects)
    .orderBy(asc(schema.clientProjects.name));

  return NextResponse.json({ updates, clients, projects, isAssignmentRestricted: false });
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || !isRole(payload.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    return postMultipart(req, payload.userId, payload.role);
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid work update" }, { status: 400 });
  }

  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.id, parsed.data.clientId));
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const projectId = parsed.data.projectId ?? null;
  if (payload.role === "employee") {
    if (projectId == null) {
      return NextResponse.json({ error: "Project is required for employee updates" }, { status: 400 });
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
    if (!assignment || assignment.clientId !== parsed.data.clientId) {
      return NextResponse.json({ error: "Project is not assigned to this employee" }, { status: 403 });
    }
  }

  if (projectId != null) {
    const [project] = await db
      .select({ id: schema.clientProjects.id })
      .from(schema.clientProjects)
      .where(
        and(
          eq(schema.clientProjects.id, projectId),
          eq(schema.clientProjects.clientId, parsed.data.clientId)
        )
      );
    if (!project) {
      return NextResponse.json({ error: "Project not found for client" }, { status: 404 });
    }
  }

  const [update] = await db
    .insert(schema.clientWorkUpdates)
    .values({
      clientId: parsed.data.clientId,
      projectId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      gitRepoUrl: emptyToNull(parsed.data.gitRepoUrl),
      screenshotUrl: null,
      documentUrl: null,
      linkUrl: null,
      attachments: [],
      status: "submitted",
      reviewedAt: null
    })
    .returning();

  return NextResponse.json({ update }, { status: 201 });
}

async function postMultipart(req: NextRequest, userId: number, role: string) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const clientId = Number(formData.get("clientId"));
  if (!Number.isFinite(clientId)) {
    return NextResponse.json({ error: "Invalid client" }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 300) {
    return NextResponse.json({ error: "Invalid title" }, { status: 400 });
  }

  const notesRaw = formData.get("notes");
  const notes =
    notesRaw == null || String(notesRaw).trim() === ""
      ? null
      : String(notesRaw).trim().slice(0, 8000);

  const projectIdRaw = formData.get("projectId");
  const projectId =
    projectIdRaw == null || String(projectIdRaw).trim() === "" ? null : Number(projectIdRaw);
  if (projectId != null && !Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  }

  if (role === "employee") {
    if (projectId == null) {
      return NextResponse.json({ error: "Project is required for employee updates" }, { status: 400 });
    }
    const [assignment] = await db
      .select({
        projectId: schema.employeeClientProjectAssignments.projectId,
        clientId: schema.employeeClientProjectAssignments.clientId
      })
      .from(schema.employeeClientProjectAssignments)
      .where(
        and(
          eq(schema.employeeClientProjectAssignments.userId, userId),
          eq(schema.employeeClientProjectAssignments.projectId, projectId)
        )
      );
    if (!assignment || assignment.clientId !== clientId) {
      return NextResponse.json({ error: "Project is not assigned to this employee" }, { status: 403 });
    }
  }

  const gitRaw = formData.get("gitRepoUrl");
  const gitRepoUrl =
    gitRaw == null || String(gitRaw).trim() === "" ? null : String(gitRaw).trim().slice(0, 2000);

  const [client] = await db
    .select({ id: schema.clients.id })
    .from(schema.clients)
    .where(eq(schema.clients.id, clientId));
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (projectId != null) {
    const [project] = await db
      .select({ id: schema.clientProjects.id })
      .from(schema.clientProjects)
      .where(and(eq(schema.clientProjects.id, projectId), eq(schema.clientProjects.clientId, clientId)));
    if (!project) {
      return NextResponse.json({ error: "Project not found for client" }, { status: 404 });
    }
  }

  const files = formData
    .getAll("files")
    .filter((x): x is File => typeof File !== "undefined" && x instanceof File && x.size > 0);

  if (files.length > MAX_WORK_FILES) {
    return NextResponse.json({ error: `Too many files (max ${MAX_WORK_FILES})` }, { status: 400 });
  }

  const [row] = await db
    .insert(schema.clientWorkUpdates)
    .values({
      clientId,
      projectId,
      title,
      notes,
      gitRepoUrl,
      screenshotUrl: null,
      documentUrl: null,
      linkUrl: null,
      attachments: [],
      status: "submitted",
      reviewedAt: null
    })
    .returning();

  const attachments: ClientWorkAttachment[] = [];
  try {
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const name = sanitizeUploadFileName(file.name);
      const checked = validateSecureUpload(buf, file.type || null, name, {
        maxBytes: CLIENT_WORK_MAX_UPLOAD_BYTES
      });
      if (!checked.ok) {
        await db.delete(schema.clientWorkUpdates).where(eq(schema.clientWorkUpdates.id, row.id));
        return NextResponse.json({ error: checked.error }, { status: checked.status });
      }
      const { storagePath } = await storeValidatedClientWorkFile(clientId, row.id, checked.value);
      attachments.push({
        fileName: checked.value.sanitizedFileName,
        storagePath,
        mimeType: checked.value.mimeType
      });
    }
  } catch {
    await db.delete(schema.clientWorkUpdates).where(eq(schema.clientWorkUpdates.id, row.id));
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  if (attachments.length === 0) {
    return NextResponse.json({ update: row }, { status: 201 });
  }

  const [updated] = await db
    .update(schema.clientWorkUpdates)
    .set({ attachments, updatedAt: new Date() })
    .where(eq(schema.clientWorkUpdates.id, row.id))
    .returning();

  return NextResponse.json({ update: updated ?? row }, { status: 201 });
}
