import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { WorkUpdateDiscussion } from "@/components/WorkUpdateDiscussion";
import { WorkUpdateMediaPreview } from "@/components/work-update-media-preview";

type ResolvedMedia = {
  src: string;
  mimeType: string;
  fileName: string;
};

function normalizeAttachments(raw: unknown): ClientWorkAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as ClientWorkAttachment[];
}

export default async function InternalWorkUpdateDetail({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  if (!session || !isRole(session.role)) {
    redirect("/login");
  }

  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();

  const [row] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      title: schema.clientWorkUpdates.title,
      notes: schema.clientWorkUpdates.notes,
      status: schema.clientWorkUpdates.status,
      projectName: schema.clientProjects.name,
      clientName: schema.clients.name,
      gitRepoUrl: schema.clientWorkUpdates.gitRepoUrl,
      attachments: schema.clientWorkUpdates.attachments,
      createdAt: schema.clientWorkUpdates.createdAt
    })
    .from(schema.clientWorkUpdates)
    .leftJoin(schema.clientProjects, eq(schema.clientWorkUpdates.projectId, schema.clientProjects.id))
    .leftJoin(schema.clients, eq(schema.clientWorkUpdates.clientId, schema.clients.id))
    .where(eq(schema.clientWorkUpdates.id, id));

  if (!row) notFound();

  const resolvedList: ResolvedMedia[] = normalizeAttachments(row.attachments).map((att, idx) => ({
    src: att.storagePath.startsWith("/uploads/")
      ? att.storagePath
      : `/api/work-updates/${row.id}/attachments/${idx}`,
    mimeType: att.mimeType,
    fileName: att.fileName
  }));

  return (
    <div className="space-y-6">
      <Link href="/work-updates" className="text-sm text-slate-500 hover:text-sky-600">
        ← Back to work updates
      </Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{row.title}</h1>
        <p className="text-xs text-slate-500">
          {row.clientName ?? "Client"} · {row.projectName ?? "General"} · {row.status}
          {row.createdAt ? ` · ${new Date(row.createdAt).toLocaleString()}` : ""}
        </p>
        {row.notes ? <p className="text-sm text-slate-600 dark:text-slate-300">{row.notes}</p> : null}
        {row.gitRepoUrl ? (
          <a href={row.gitRepoUrl} target="_blank" rel="noreferrer" className="text-sm text-sky-600 hover:underline">
            {row.gitRepoUrl}
          </a>
        ) : null}
      </header>

      {resolvedList.length > 0 ? (
        <section className="flex flex-wrap gap-4">
          {resolvedList.map((item, idx) => (
            <WorkUpdateMediaPreview key={`${idx}-${item.fileName}`} item={item} />
          ))}
        </section>
      ) : null}

      <WorkUpdateDiscussion workUpdateId={row.id} canReview={false} initialStatus={row.status} />
    </div>
  );
}
