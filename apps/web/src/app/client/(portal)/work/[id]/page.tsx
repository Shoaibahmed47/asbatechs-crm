import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { WorkUpdateDiscussion } from "@/components/WorkUpdateDiscussion";
import { WorkUpdateMediaPreview } from "@/components/work-update-media-preview";

export const dynamic = "force-dynamic";

function normalizeAttachments(raw: unknown): ClientWorkAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as ClientWorkAttachment[];
}

type ResolvedMedia = {
  src: string;
  mimeType: string;
  fileName: string;
};

function LegacyLinkCard({ href, label }: { href: string; label: string }) {
  const looksLikeImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(href);
  if (looksLikeImage) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900/50">
        <div className="border-b border-slate-300 px-3 py-2 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-200/80">{label}</div>
        <div className="p-3">
          <img src={href} alt={label} className="mx-auto max-h-[min(70vh,36rem)] w-full object-contain" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-400 hover:underline">
        {label}
      </a>
    </div>
  );
}

export default async function ClientWorkUpdateDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) {
    notFound();
  }

  const workId = Number((await params).id);
  if (!Number.isFinite(workId)) {
    notFound();
  }

  const [row] = await db
    .select({
      id: schema.clientWorkUpdates.id,
      title: schema.clientWorkUpdates.title,
      notes: schema.clientWorkUpdates.notes,
      projectId: schema.clientWorkUpdates.projectId,
      gitRepoUrl: schema.clientWorkUpdates.gitRepoUrl,
      screenshotUrl: schema.clientWorkUpdates.screenshotUrl,
      documentUrl: schema.clientWorkUpdates.documentUrl,
      linkUrl: schema.clientWorkUpdates.linkUrl,
      attachments: schema.clientWorkUpdates.attachments,
      status: schema.clientWorkUpdates.status,
      createdAt: schema.clientWorkUpdates.createdAt,
      projectName: schema.clientProjects.name
    })
    .from(schema.clientWorkUpdates)
    .leftJoin(
      schema.clientProjects,
      eq(schema.clientWorkUpdates.projectId, schema.clientProjects.id)
    )
    .where(
      and(
        eq(schema.clientWorkUpdates.id, workId),
        eq(schema.clientWorkUpdates.clientId, session.clientId)
      )
    );

  if (!row) {
    notFound();
  }

  const attachmentList = normalizeAttachments(row.attachments);
  const resolvedList: ResolvedMedia[] = attachmentList.map((att, idx) => ({
    src: att.storagePath.startsWith("/uploads/")
      ? att.storagePath
      : `/api/client/work-updates/${row.id}/attachments/${idx}`,
    mimeType: att.mimeType,
    fileName: att.fileName
  }));

  const projectLabel =
    row.projectId == null
      ? "General"
      : row.projectName?.trim() || `Project #${row.projectId}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/client" className="text-slate-600 hover:text-sky-600 dark:text-slate-500 dark:hover:text-sky-400">
          ← Dashboard
        </Link>
        <span className="text-slate-600">/</span>
        <Link href="/client/work" className="text-slate-600 hover:text-sky-600 dark:text-slate-500 dark:hover:text-sky-400">
          Work updates
        </Link>
      </div>

      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white px-5 py-5 dark:border-slate-800 dark:from-slate-950/40 dark:to-slate-900/50">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Work update
          </p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{row.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <span className="text-slate-500 dark:text-slate-400">Project</span>
              <span className="max-w-[14rem] truncate">{projectLabel}</span>
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
                  Message from your team
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

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
          Photos, videos & files
        </h2>

        {resolvedList.length === 0 &&
        !row.screenshotUrl &&
        !row.documentUrl &&
        !row.linkUrl ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-500">
            No files were attached to this update.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {resolvedList.map((item, idx) => (
              <WorkUpdateMediaPreview key={`att-${idx}-${item.fileName}`} item={item} />
            ))}

            {row.screenshotUrl ? (
              <LegacyLinkCard href={row.screenshotUrl} label="Screenshot (legacy)" />
            ) : null}
            {row.documentUrl ? (
              <LegacyLinkCard href={row.documentUrl} label="Document (legacy)" />
            ) : null}
            {row.linkUrl ? (
              <LegacyLinkCard href={row.linkUrl} label="Link (legacy)" />
            ) : null}
          </div>
        )}
      </section>

      <WorkUpdateDiscussion workUpdateId={row.id} canReview initialStatus={row.status} />

      <p className="text-xs text-slate-600">
        If a file does not load, return here from the dashboard and open this page again — download links
        expire after a short time when using cloud storage.
      </p>
    </div>
  );
}
