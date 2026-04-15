export const roles = ["admin", "manager", "employee"] as const;

export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export function normalizeRole(role: string | undefined): string {
  return typeof role === "string" ? role.trim().toLowerCase() : "";
}

export function isAdminRole(role: string | undefined): boolean {
  return normalizeRole(role) === "admin";
}

export function isManagerRole(role: string | undefined): boolean {
  return normalizeRole(role) === "manager";
}

/** Who may open the Employee directory page (read-only for managers). */
export function canViewEmployeeDirectory(role: string | undefined): boolean {
  return isAdminRole(role) || isManagerRole(role);
}

export const assignableUserRoles: Role[] = ["employee", "manager"];

