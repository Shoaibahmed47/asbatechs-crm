import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { normalizeRole } from "@/lib/rbac";
import AttendanceLoading from "./loading";

const AttendancePageClient = dynamic(() => import("./AttendancePageClient"), {
  loading: () => <AttendanceLoading />
});

export default async function AttendancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  const initialRole = normalizeRole(session?.role);

  return <AttendancePageClient initialRole={initialRole} />;
}
