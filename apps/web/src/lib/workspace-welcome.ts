import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import type { WorkspaceWelcomeProfile } from "@/components/WorkspaceWelcomeBanner";

/** Prefer real name; never greet with a full email address. */
export function toWelcomeFirstName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmedName = name?.trim() ?? "";
  if (trimmedName && !trimmedName.includes("@")) {
    const first = trimmedName.split(/\s+/)[0];
    if (first) return first;
  }

  const emailLocal = (email?.trim().split("@")[0] ?? trimmedName.split("@")[0] ?? "").trim();
  if (emailLocal) {
    const stem = emailLocal.split(/\d/)[0]?.split(/[._-]+/)[0] ?? "";
    if (stem.length >= 2) {
      return stem.charAt(0).toUpperCase() + stem.slice(1).toLowerCase();
    }
  }

  return "there";
}

export async function getWorkspaceWelcomeProfile(
  userId: number
): Promise<WorkspaceWelcomeProfile> {
  return unstable_cache(
    () => fetchWorkspaceWelcomeProfile(userId),
    ["workspace-welcome-profile", String(userId)],
    { revalidate: 120 }
  )();
}

async function fetchWorkspaceWelcomeProfile(
  userId: number
): Promise<WorkspaceWelcomeProfile> {
  try {
    const [row] = await db
      .select({
        name: schema.users.name,
        email: schema.users.email,
        departmentName: schema.departments.name
      })
      .from(schema.users)
      .leftJoin(schema.departments, eq(schema.users.departmentId, schema.departments.id))
      .where(eq(schema.users.id, userId));

    return {
      firstName: toWelcomeFirstName(row?.name, row?.email),
      departmentName: row?.departmentName?.trim() ?? null
    };
  } catch (error) {
    console.error("[workspace-welcome] profile lookup failed", error);
    return { firstName: "there", departmentName: null };
  }
}
