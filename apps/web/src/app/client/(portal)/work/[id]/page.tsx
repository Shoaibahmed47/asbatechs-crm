import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";
import { getClientPortalRequestOrigin } from "@/lib/client-portal-origin";
import { getClientWorkFileDownloadLink } from "@/lib/client-work-attachment-storage";
import { WorkUpdateDiscussion } from "@/components/WorkUpdateDiscussion";

export const dynamic = "force-dynamic";

function normalizeAttachments(raw: unknown): ClientWorkAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as ClientWorkAttachment[];
}

type ResolvedMedia = {
  url: string;
  mimeType: string;
  fileName: string;
};

function WorkUpdateMediaCard({ item }: { item: ResolvedMedia }) {
  const { url, mimeType, fileName } = item;

  if (mimeType.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">{fileName}</div>
        <div className="p-3">
          <img
            src={url}
            alt={fileName}
            className="mx-auto max-h-[min(70vh,36rem)] w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (mimeType.startsWith("video/")) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">{fileName}</div>
        <div className="p-3">
          <video
            controls
            playsInline
            preload="metadata"
            src={url}
            className="w-full rounded-lg bg-black"
          />
        </div>
      </div>
    );
  }

  if (mimeType === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-3 py-2 text-xs text-slate-400">{fileName}</div>
        <div className="p-3">
          <iframe title={fileName} src={url} className="h-[min(70vh,36rem)] w-full rounded-lg bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-sm text-slate-300">{fileName}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm font-medium text-sky-400 hover:underline"
      >
        Open or download
      </a>
    </div>
  );
}

function LegacyLinkCard({ href, label }: { href: string; label: string }) {
  const looksLikeImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(href);
  if (looksLikeImage) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-3 py-2 text-xs text-amber-200/80">{label}</div>
        <div className="p-3">
          <img src={href} alt={label} className="mx-auto max-h-[min(70vh,36rem)] w-full object-contain" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
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

  const origin = await getClientPortalRequestOrigin();

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
  const resolvedList = (
    await Promise.all(
      attachmentList.map(async (att) => {
        const link = await getClientWorkFileDownloadLink(att.storagePath, origin, att.mimeType);
        if (!link) return null;
        return { url: link.url, mimeType: att.mimeType, fileName: att.fileName } satisfies ResolvedMedia;
      })
    )
  ).filter((x): x is ResolvedMedia => x != null);

  const projectLabel =
    row.projectId == null
      ? "General"
      : row.projectName?.trim() || `Project #${row.projectId}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/client" className="text-slate-500 hover:text-sky-400">
          ← Dashboard
        </Link>
        <span className="text-slate-600">/</span>
        <Link href="/client/work" className="text-slate-500 hover:text-sky-400">
          Work updates
        </Link>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-white">{row.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{projectLabel}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{row.status}</span>
          {row.createdAt ? <span>{new Date(row.createdAt).toLocaleString()}</span> : null}
        </div>
        {row.notes ? <p className="max-w-3xl pt-2 text-sm leading-relaxed text-slate-400">{row.notes}</p> : null}
        {row.gitRepoUrl ? (
          <p className="pt-2 text-sm">
            <span className="text-slate-500">Repository: </span>
            <a
              href={row.gitRepoUrl}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-400 hover:underline"
            >
              {row.gitRepoUrl}
            </a>
          </p>
        ) : null}
      </header>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Photos, videos & files
        </h2>

        {resolvedList.length === 0 &&
        !row.screenshotUrl &&
        !row.documentUrl &&
        !row.linkUrl ? (
          <p className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
            No files were attached to this update.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {resolvedList.map((item, idx) => (
              <WorkUpdateMediaCard key={`att-${idx}-${item.fileName}`} item={item} />
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
