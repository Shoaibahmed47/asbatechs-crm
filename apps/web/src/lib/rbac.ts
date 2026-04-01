export const roles = ["admin", "manager", "employee"] as const;

export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export function isAdminRole(role: string | undefined): boolean {
  return typeof role === "string" && role.toLowerCase() === "admin";
}

export function isManagerRole(role: string | undefined): boolean {
  return role === "manager";
}

/** Who may open the Employee directory page (read-only for managers). */
export function canViewEmployeeDirectory(role: string | undefined): boolean {
  return isAdminRole(role) || isManagerRole(role);
}

export const assignableUserRoles: Role[] = ["employee", "manager"];

