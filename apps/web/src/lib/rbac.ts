export const roles = ["admin", "manager", "employee"] as const;

export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (roles as readonly string[]).includes(value);
}

export const assignableUserRoles: Role[] = ["employee", "manager"];

