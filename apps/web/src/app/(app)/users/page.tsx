import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { InviteEmployeeButton } from "@/components/InviteEmployeeButton";
import { EmployeeDirectoryPanel } from "@/components/EmployeeDirectoryPanel";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { canViewEmployeeDirectory, isAdminRole } from "@/lib/rbac";

export default async function UsersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? await verifyAuthToken(token) : null;
  if (!session || !canViewEmployeeDirectory(session.role)) {
    redirect("/dashboard");
  }

  const isAdmin = isAdminRole(session.role);

  if (session.role === "manager" && session.departmentId == null) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="app-panel rounded-[28px] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              Administration
            </div>
            <h1 className="page-title mt-3">Employee directory</h1>
            <p className="page-subtitle">
              {isAdmin
                ? "Manage employee records, invitation status, and department ownership from one centralized view."
                : "People in your department and related pending invitations (read-only). Ask an admin to invite employees or send password resets."}
            </p>
          </div>
          {isAdmin ? <InviteEmployeeButton /> : null}
        </div>
      </div>
      <EmployeeDirectoryPanel allowAdminActions={isAdmin} />
    </div>
  );
}
