import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ClientDashboard } from "@/components/ClientDashboard";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { getClientSession } from "@/lib/client-session";

export default async function ClientDashboardPage() {
  const session = await getClientSession();
  if (!session) redirect("/client/login");

  const [client] = await db
    .select({
      name: schema.clients.name
    })
    .from(schema.clients)
    .where(eq(schema.clients.id, session.clientId));

  return <ClientDashboard clientName={client?.name ?? null} />;
}
