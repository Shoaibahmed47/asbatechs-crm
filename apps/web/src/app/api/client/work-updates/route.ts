import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { z } from "zod";
import {
  CLIENT_WORK_MAX_UPLOAD_BYTES,
  sanitizeUploadFileName,
  validateSecureUpload
} from "@/lib/secure-upload";
import { storeValidatedClientWorkFile } from "@/lib/client-work-attachment-storage";

const optionalGit = z.string().max(2000).nullable().optional();

const createSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(8000).nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  gitRepoUrl: optionalGit
});

function emptyToNull(s: string | null | undefined): string | null {
  if (s == null || s === "") return null;
  return s;
}

const MAX_WORK_FILES = 10;

function normalizeClientAttachments(raw: unknown): ClientWorkAttachment[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rec = item as Record<string, unknown>;
        const fileName =
          typeof rec.fileName === "string"
            ? rec.fileName
            : typeof rec.name === "string"
              ? rec.name
              : null;
        const storagePath =
          typeof rec.storagePath === "string"
            ? rec.storagePath
            : typeof rec.path === "string"
              ? rec.path
              : typeof rec.url === "string"
                ? rec.url
                : null;
        const mimeType =
          typeof rec.mimeType === "string"
            ? rec.mimeType
            : typeof rec.type === "string"
              ? rec.type
              : "application/octet-stream";
        if (!fileName || !storagePath) return null;
        return { fileName, storagePath, mimeType } satisfies ClientWorkAttachment;
      })
      .filter((x): x is ClientWorkAttachment => x != null);
  }

  if (typeof raw === "string") {
    try {
      return normalizeClientAttachments(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  return [];
}

export async function GET() {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: schema.clientWorkUpdates.id,
      clientId: schema.clientWorkUpdates.clientId,
      projectId: schema.clientWorkUpdates.projectId,
      title: schema.clientWorkUpdates.title,
      notes: schema.clientWorkUpdates.notes,
      screenshotUrl: schema.clientWorkUpdates.screenshotUrl,
      gitRepoUrl: schema.clientWorkUpdates.gitRepoUrl,
      documentUrl: schema.clientWorkUpdates.documentUrl,
      linkUrl: schema.clientWorkUpdates.linkUrl,
      attachments: schema.clientWorkUpdates.attachments,
      status: schema.clientWorkUpdates.status,
      createdAt: schema.clientWorkUpdates.createdAt,
      updatedAt: schema.clientWorkUpdates.updatedAt,
      authorType: schema.clientWorkUpdates.authorType,
      authorUserName: schema.users.name,
      clientName: schema.clients.name
    })
    .from(schema.clientWorkUpdates)
    .leftJoin(schema.users, eq(schema.clientWorkUpdates.authorUserId, schema.users.id))
    .leftJoin(schema.clients, eq(schema.clientWorkUpdates.clientId, schema.clients.id))
    .where(eq(schema.clientWorkUpdates.clientId, session.clientId))
    .orderBy(desc(schema.clientWorkUpdates.createdAt));

  const updates = rows.map((row) => ({
    ...row,
    attachments: normalizeClientAttachments(row.attachments),
    authorName:
      row.authorType === "client"
        ? (row.clientName ?? "Client")
        : (row.authorUserName ?? "Team member")
  }));

  return NextResponse.json({ updates });
}

async function resolveProjectForClient(
  sessionClientId: number,
  projectId: number | null
): Promise<{ ok: true; projectId: number | null } | { ok: false; res: NextResponse }> {
  if (projectId == null) return { ok: true, projectId: null };
  const [owned] = await db
    .select({ id: schema.clientProjects.id })
    .from(schema.clientProjects)
    .where(
      and(
        eq(schema.clientProjects.id, projectId),
        eq(schema.clientProjects.clientId, sessionClientId)
      )
    );
  if (!owned) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Project not found" }, { status: 404 })
    };
  }
  return { ok: true, projectId };
}

export async function POST(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctype = req.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    return postMultipart(req, session.clientId);
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid work update", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let projectId: number | null = parsed.data.projectId ?? null;
  const projRes = await resolveProjectForClient(session.clientId, projectId);
  if (!projRes.ok) return projRes.res;
  projectId = projRes.projectId;

  const [row] = await db
    .insert(schema.clientWorkUpdates)
    .values({
      clientId: session.clientId,
      authorType: "client",
      authorClientId: session.clientId,
      projectId,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      screenshotUrl: null,
      gitRepoUrl: emptyToNull(parsed.data.gitRepoUrl ?? undefined),
      documentUrl: null,
      linkUrl: null,
      attachments: [],
      status: "submitted",
      reviewedAt: null
    })
    .returning();

  return NextResponse.json({ update: row }, { status: 201 });
}

async function postMultipart(req: NextRequest, clientId: number) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("10mb") || message.includes("body") || message.includes("size")) {
      return NextResponse.json(
        { error: "Upload payload too large. Keep total upload size within 100MB." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
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
  let projectId: number | null = null;
  if (projectIdRaw != null && String(projectIdRaw).trim() !== "") {
    const n = Number(projectIdRaw);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "Invalid project" }, { status: 400 });
    }
    projectId = n;
  }

  const gitRaw = formData.get("gitRepoUrl");
  const gitRepoUrl =
    gitRaw == null || String(gitRaw).trim() === ""
      ? null
      : String(gitRaw).trim().slice(0, 2000);

  const projRes = await resolveProjectForClient(clientId, projectId);
  if (!projRes.ok) return projRes.res;
  projectId = projRes.projectId;

  const fileEntries = formData
    .getAll("files")
    .filter((x): x is File => typeof File !== "undefined" && x instanceof File && x.size > 0);

  if (fileEntries.length > MAX_WORK_FILES) {
    return NextResponse.json(
      { error: `Too many files (max ${MAX_WORK_FILES})` },
      { status: 400 }
    );
  }

  const [row] = await db
    .insert(schema.clientWorkUpdates)
    .values({
      clientId,
      authorType: "client",
      authorClientId: clientId,
      projectId,
      title,
      notes,
      screenshotUrl: null,
      gitRepoUrl,
      documentUrl: null,
      linkUrl: null,
      attachments: [],
      status: "submitted",
      reviewedAt: null
    })
    .returning();

  const attachments: ClientWorkAttachment[] = [];

  try {
    for (const file of fileEntries) {
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
