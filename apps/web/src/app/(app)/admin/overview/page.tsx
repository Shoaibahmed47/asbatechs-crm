import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminOverviewClient } from "@/components/AdminOverviewClient";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getAdminSnapshot } from "@/lib/admin-snapshot";

export default async function AdminOverviewPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;

  if (
    !payload ||
    (payload.role !== "admin" && payload.role !== "manager")
  ) {
    redirect("/dashboard");
  }

  const snapshot = await getAdminSnapshot();

  return (
    <AdminOverviewClient snapshot={snapshot} role={payload.role as "admin" | "manager"} />
  );
}
