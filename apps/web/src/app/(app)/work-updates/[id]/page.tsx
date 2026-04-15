import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schema, type ClientWorkAttachment } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isRole } from "@/lib/rbac";
import { WorkUpdateDiscussion } from "@/components/WorkUpdateDiscussion";
import { getClientPortalRequestOrigin } from "@/lib/client-portal-origin";
import { getClientWorkFileDownloadLink } from "@/lib/client-work-attachment-storage";

type ResolvedMedia = {
  url: string;
  mimeType: string;
  fileName: string;
};

function normalizeAttachments(raw: unknown): ClientWorkAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw as ClientWorkAttachment[];
}

function MediaCard({ item }: { item: ResolvedMedia }) {
  if (item.mimeType.startsWith("image/")) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
        <div className="border-b border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">
          {item.fileName}
        </div>
        <img src={item.url} alt={item.fileName} className="max-h-[32rem] w-full object-contain p-3" />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-sm text-slate-600 dark:text-slate-300">{item.fileName}</p>
      <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-600 hover:underline">
        Open file
      </a>
    </div>
  );
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

  const origin = await getClientPortalRequestOrigin();
  const resolvedList = (
    await Promise.all(
      normalizeAttachments(row.attachments).map(async (att) => {
        const link = await getClientWorkFileDownloadLink(att.storagePath, origin, att.mimeType);
        if (!link) return null;
        return { url: link.url, mimeType: att.mimeType, fileName: att.fileName } satisfies ResolvedMedia;
      })
    )
  ).filter((x): x is ResolvedMedia => x != null);

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
        <section className="grid gap-4 lg:grid-cols-2">
          {resolvedList.map((item, idx) => (
            <MediaCard key={`${idx}-${item.fileName}`} item={item} />
          ))}
        </section>
      ) : null}

      <WorkUpdateDiscussion workUpdateId={row.id} canReview={false} initialStatus={row.status} />
    </div>
  );
}
