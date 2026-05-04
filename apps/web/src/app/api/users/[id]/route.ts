import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { and, eq, inArray } from "drizzle-orm";
import { COOKIE_NAME, verifyAuthToken, hashPassword } from "@/lib/auth";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["admin", "manager", "employee"]).optional(),
  departmentId: z.number().nullable().optional()
});

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id));
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId
    }
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const update: any = { ...parsed.data };
  if (update.password) {
    update.passwordHash = await hashPassword(update.password);
    delete update.password;
  }

  const [user] = await db
    .update(schema.users)
    .set(update)
    .where(eq(schema.users.id, id))
    .returning();

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId
    }
  });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  if (id === payload.userId) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const [target] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, id));

  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (target.role === "admin") {
    const adminRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"));
    if (adminRows.length <= 1) {
      return NextResponse.json({ error: "Cannot delete the last admin." }, { status: 400 });
    }

    const [anotherAdmin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.role, "admin"), eq(schema.users.id, payload.userId)));

    if (!anotherAdmin) {
      return NextResponse.json({ error: "Only an existing admin can remove another admin." }, { status: 403 });
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.leads)
        .set({ assignedUserId: null })
        .where(eq(schema.leads.assignedUserId, id));

      const attendanceRows = await tx
        .select({ id: schema.attendanceLogs.id })
        .from(schema.attendanceLogs)
        .where(eq(schema.attendanceLogs.userId, id));

      if (attendanceRows.length > 0) {
        const attendanceIds = attendanceRows.map((row) => row.id);
        await tx
          .delete(schema.breakSessions)
          .where(inArray(schema.breakSessions.attendanceLogId, attendanceIds));
      }

      await tx.delete(schema.attendanceLogs).where(eq(schema.attendanceLogs.userId, id));
      await tx.delete(schema.notifications).where(eq(schema.notifications.userId, id));
      await tx.delete(schema.leadNotes).where(eq(schema.leadNotes.userId, id));
      await tx.delete(schema.activityLogs).where(eq(schema.activityLogs.userId, id));
      await tx
        .delete(schema.employeeClientProjectAssignments)
        .where(eq(schema.employeeClientProjectAssignments.userId, id));
      await tx
        .update(schema.employeeClientProjectAssignments)
        .set({ assignedByUserId: null })
        .where(eq(schema.employeeClientProjectAssignments.assignedByUserId, id));
      await tx
        .update(schema.clientWorkComments)
        .set({ actorUserId: null })
        .where(eq(schema.clientWorkComments.actorUserId, id));
      await tx.delete(schema.invitations).where(eq(schema.invitations.invitedByUserId, id));
      await tx
        .delete(schema.clientInvitations)
        .where(eq(schema.clientInvitations.invitedByUserId, id));

      await tx.delete(schema.users).where(eq(schema.users.id, id));
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to remove user:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during user delete.";
    return NextResponse.json(
      {
        error: `Could not remove this employee: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}

