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
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-5 dark:border-slate-800 dark:from-slate-950/40 dark:to-slate-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Work update
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{row.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span className="shrink-0 text-slate-500 dark:text-slate-400">Client</span>
              <span className="min-w-0 truncate">{row.clientName ?? "—"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span className="text-slate-500 dark:text-slate-400">Project</span>
              <span className="max-w-[12rem] truncate">{row.projectName ?? "General"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span className="text-slate-500 dark:text-slate-400">Status</span>
              <span>{row.status}</span>
            </span>
            {row.createdAt ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium tabular-nums text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        {row.notes || row.gitRepoUrl ? (
          <div className="space-y-5 px-5 py-5">
            {row.notes ? (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Notes
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 dark:text-slate-300">{row.notes}</p>
              </div>
            ) : null}
            {row.gitRepoUrl ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Repository
                </h2>
                <a
                  href={row.gitRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block break-all text-sm font-medium text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                >
                  {row.gitRepoUrl}
                </a>
              </div>
            ) : null}
          </div>
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
