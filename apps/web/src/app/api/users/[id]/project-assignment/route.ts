import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const bodySchema = z.object({
  projectIds: z.array(z.number().int().positive()).max(100)
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = Number((await ctx.params).id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const [user] = await db
    .select({ id: schema.users.id, role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role !== "employee") {
    return NextResponse.json({ error: "Only employees can be assigned" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const uniqueProjectIds = Array.from(new Set(parsed.data.projectIds));
  if (uniqueProjectIds.length === 0) {
    await db
      .delete(schema.employeeClientProjectAssignments)
      .where(eq(schema.employeeClientProjectAssignments.userId, userId));
    return NextResponse.json({ ok: true, assignments: [] });
  }

  const projects = await db
    .select({
      id: schema.clientProjects.id,
      clientId: schema.clientProjects.clientId
    })
    .from(schema.clientProjects)
    .where(inArray(schema.clientProjects.id, uniqueProjectIds));
  if (projects.length !== uniqueProjectIds.length) {
    return NextResponse.json({ error: "One or more projects not found" }, { status: 404 });
  }

  await db
    .delete(schema.employeeClientProjectAssignments)
    .where(
      and(
        eq(schema.employeeClientProjectAssignments.userId, userId),
        notInArray(schema.employeeClientProjectAssignments.projectId, uniqueProjectIds)
      )
    );

  const existingAssignments = await db
    .select({ projectId: schema.employeeClientProjectAssignments.projectId })
    .from(schema.employeeClientProjectAssignments)
    .where(eq(schema.employeeClientProjectAssignments.userId, userId));

  const existingProjectIdSet = new Set(existingAssignments.map((a) => a.projectId));
  const rowsToInsert = projects
    .filter((project) => !existingProjectIdSet.has(project.id))
    .map((project) => ({
      userId,
      clientId: project.clientId,
      projectId: project.id,
      assignedByUserId: payload.userId
    }));

  if (rowsToInsert.length > 0) {
    await db.insert(schema.employeeClientProjectAssignments).values(rowsToInsert);
  }

  const assignments = await db
    .select({
      userId: schema.employeeClientProjectAssignments.userId,
      projectId: schema.employeeClientProjectAssignments.projectId,
      projectName: schema.clientProjects.name,
      clientName: schema.clients.name
    })
    .from(schema.employeeClientProjectAssignments)
    .innerJoin(
      schema.clientProjects,
      eq(schema.employeeClientProjectAssignments.projectId, schema.clientProjects.id)
    )
    .innerJoin(schema.clients, eq(schema.employeeClientProjectAssignments.clientId, schema.clients.id))
    .where(eq(schema.employeeClientProjectAssignments.userId, userId));

  return NextResponse.json({
    ok: true,
    assignments: assignments.map((assignment) => ({
      userId: assignment.userId,
      projectId: assignment.projectId,
      label: `${assignment.clientName} — ${assignment.projectName}`
    }))
  });
}
