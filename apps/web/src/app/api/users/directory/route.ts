import { NextRequest } from "next/server";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  notExists,
  or,
  sql
} from "drizzle-orm";
import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { canViewEmployeeDirectory, isAdminRole } from "@/lib/rbac";
import { parseListPagination } from "@/lib/leads-query";
import { errorJson, okJson, withObservedRequest } from "@/lib/observability";

export async function GET(req: NextRequest) {
  return withObservedRequest(req, async (ctx) => {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    const payload = token ? await verifyAuthToken(token) : null;
    if (!payload || !canViewEmployeeDirectory(payload.role)) {
      return errorJson(ctx, 401, "Unauthorized");
    }

  const isAdmin = isAdminRole(payload.role);
  const managerDeptId = payload.role === "manager" ? payload.departmentId : null;
    if (payload.role === "manager" && managerDeptId == null) {
      return errorJson(ctx, 403, "Forbidden");
    }

  const { searchParams } = new URL(req.url);
  const kindRaw = searchParams.get("kind") ?? "all";
  const kind = ["all", "user", "invite"].includes(kindRaw) ? kindRaw : "all";

  const deptFilter = searchParams.get("departmentId");
  const userIdFilter = searchParams.get("userId");
  const roleFilter = searchParams.get("role")?.trim();
  const inviteStatusFilter = searchParams.get("inviteStatus")?.trim();
  const search = searchParams.get("search")?.trim();
  const createdFrom = searchParams.get("createdFrom")?.trim();
  const createdTo = searchParams.get("createdTo")?.trim();

  const sortRaw = searchParams.get("sort") ?? "created_at";
  const sort = ["created_at", "name", "email", "role", "department_id"].includes(sortRaw)
    ? sortRaw
    : "created_at";
  const orderRaw = (searchParams.get("order") ?? "desc").toLowerCase();
  const order = orderRaw === "asc" ? "asc" : "desc";

  if (deptFilter && deptFilter !== "" && !Number.isNaN(Number(deptFilter))) {
    const d = Number(deptFilter);
    if (!isAdmin && managerDeptId !== d) {
      return errorJson(ctx, 403, "Forbidden");
    }
  }

  if (
    userIdFilter &&
    userIdFilter !== "" &&
    !Number.isNaN(Number(userIdFilter)) &&
    payload.role === "manager"
  ) {
    const uid = Number(userIdFilter);
    const [u] = await db
      .select({ departmentId: schema.users.departmentId })
      .from(schema.users)
      .where(eq(schema.users.id, uid));
    if (!u || u.departmentId !== managerDeptId) {
      return errorJson(ctx, 403, "Forbidden");
    }
  }

  const { page, limit, offset } = parseListPagination(searchParams);

  const userConditions = [];
  if (!isAdmin) {
    userConditions.push(eq(schema.users.departmentId, managerDeptId!));
  }
  if (deptFilter && deptFilter !== "" && !Number.isNaN(Number(deptFilter))) {
    userConditions.push(eq(schema.users.departmentId, Number(deptFilter)));
  }
  if (userIdFilter && userIdFilter !== "" && !Number.isNaN(Number(userIdFilter))) {
    userConditions.push(eq(schema.users.id, Number(userIdFilter)));
  }
  if (roleFilter && ["admin", "manager", "employee"].includes(roleFilter)) {
    userConditions.push(eq(schema.users.role, roleFilter));
  }
  if (inviteStatusFilter && ["pending", "accepted"].includes(inviteStatusFilter)) {
    userConditions.push(eq(schema.users.inviteStatus, inviteStatusFilter));
  }
  if (search) {
    const p = `%${search}%`;
    userConditions.push(or(ilike(schema.users.name, p), ilike(schema.users.email, p))!);
  }
  if (createdFrom && /^\d{4}-\d{2}-\d{2}$/.test(createdFrom)) {
    userConditions.push(
      gte(schema.users.createdAt, new Date(`${createdFrom}T00:00:00.000Z`))
    );
  }
  if (createdTo && /^\d{4}-\d{2}-\d{2}$/.test(createdTo)) {
    userConditions.push(
      lte(schema.users.createdAt, new Date(`${createdTo}T23:59:59.999Z`))
    );
  }

  const inviteConditions = [isNull(schema.invitations.acceptedAt)];
  inviteConditions.push(
    notExists(
      db
        .select({ one: sql`1`.as("one") })
        .from(schema.users)
        .where(sql`lower(${schema.users.email}) = lower(${schema.invitations.email})`)
    )
  );
  if (!isAdmin) {
    inviteConditions.push(eq(schema.invitations.departmentId, managerDeptId!));
  }
  if (deptFilter && deptFilter !== "" && !Number.isNaN(Number(deptFilter))) {
    inviteConditions.push(eq(schema.invitations.departmentId, Number(deptFilter)));
  }
  if (search) {
    inviteConditions.push(ilike(schema.invitations.email, `%${search}%`));
  }
  if (createdFrom && /^\d{4}-\d{2}-\d{2}$/.test(createdFrom)) {
    inviteConditions.push(
      gte(schema.invitations.createdAt, new Date(`${createdFrom}T00:00:00.000Z`))
    );
  }
  if (createdTo && /^\d{4}-\d{2}-\d{2}$/.test(createdTo)) {
    inviteConditions.push(
      lte(schema.invitations.createdAt, new Date(`${createdTo}T23:59:59.999Z`))
    );
  }

  const omitInvites =
    kind === "user" ||
    (!!roleFilter && ["admin", "manager", "employee"].includes(roleFilter)) ||
    inviteStatusFilter === "accepted" ||
    (!!userIdFilter && userIdFilter !== "" && !Number.isNaN(Number(userIdFilter)));
  const onlyInvites = kind === "invite";

  const userWhere = userConditions.length ? and(...userConditions) : undefined;
  const inviteWhere = and(...inviteConditions);

  const dir = order === "asc" ? asc : desc;

  const orderUser = (() => {
    if (sort === "email") return [dir(schema.users.email), dir(schema.users.id)];
    if (sort === "name") return [dir(schema.users.name), dir(schema.users.id)];
    if (sort === "role") return [dir(schema.users.role), dir(schema.users.id)];
    if (sort === "department_id")
      return [dir(schema.users.departmentId), dir(schema.users.id)];
    return [dir(schema.users.createdAt), dir(schema.users.id)];
  })();

  const orderInvite = (() => {
    if (sort === "email") return [dir(schema.invitations.email), dir(schema.invitations.id)];
    if (sort === "name") return [dir(schema.invitations.email), dir(schema.invitations.id)];
    if (sort === "role")
      return [dir(schema.invitations.createdAt), dir(schema.invitations.id)];
    if (sort === "department_id")
      return [dir(schema.invitations.departmentId), dir(schema.invitations.id)];
    return [dir(schema.invitations.createdAt), dir(schema.invitations.id)];
  })();

  const orderUnion = (() => {
    if (sort === "email") return [dir(sql`email`), dir(sql`id`)];
    if (sort === "name") return [dir(sql`name`), dir(sql`id`)];
    if (sort === "role") return [dir(sql`role`), dir(sql`id`)];
    if (sort === "department_id") return [dir(sql`department_id`), dir(sql`id`)];
    return [dir(sql`created_at`), dir(sql`id`)];
  })();

  let total = 0;
  let rows: {
    kind: string;
    id: number;
    name: string | null;
    email: string;
    role: string;
    departmentId: number | null;
    inviteStatus: string;
    createdAt: Date | null;
  }[] = [];

  if (onlyInvites) {
    total = await db.$count(schema.invitations, inviteWhere);
    const invRows = await db
      .select({
        kind: sql<string>`'invite'`.as("kind"),
        id: schema.invitations.id,
        name: sql<string>`''`.as("name"),
        email: schema.invitations.email,
        role: sql<string>`'pending'`.as("role"),
        departmentId: schema.invitations.departmentId,
        inviteStatus: sql<string>`'pending'`.as("invite_status"),
        createdAt: schema.invitations.createdAt
      })
      .from(schema.invitations)
      .where(inviteWhere)
      .orderBy(...orderInvite)
      .limit(limit)
      .offset(offset);
    rows = invRows.map((r) => ({
      kind: r.kind,
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      departmentId: r.departmentId,
      inviteStatus: r.inviteStatus,
      createdAt: r.createdAt
    }));
  } else if (omitInvites) {
    total = userWhere ? await db.$count(schema.users, userWhere) : await db.$count(schema.users);
    const userListBase = db
      .select({
        kind: sql<string>`'user'`.as("kind"),
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        departmentId: schema.users.departmentId,
        inviteStatus: schema.users.inviteStatus,
        createdAt: schema.users.createdAt
      })
      .from(schema.users);
    const uRows = await (userWhere ? userListBase.where(userWhere) : userListBase)
      .orderBy(...orderUser)
      .limit(limit)
      .offset(offset);
    rows = uRows.map((r) => ({
      kind: r.kind,
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      departmentId: r.departmentId,
      inviteStatus: r.inviteStatus,
      createdAt: r.createdAt
    }));
  } else {
    const buildUnion = () => {
      const userPart = db
        .select({
          kind: sql<string>`'user'`.as("kind"),
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          role: schema.users.role,
          departmentId: schema.users.departmentId,
          inviteStatus: schema.users.inviteStatus,
          createdAt: schema.users.createdAt
        })
        .from(schema.users);
      return (userWhere ? userPart.where(userWhere) : userPart).unionAll(
          db
            .select({
              kind: sql<string>`'invite'`.as("kind"),
              id: schema.invitations.id,
              name: sql<string>`''`.as("name"),
              email: schema.invitations.email,
              role: sql<string>`'pending'`.as("role"),
              departmentId: schema.invitations.departmentId,
              inviteStatus: sql<string>`'pending'`.as("invite_status"),
              createdAt: schema.invitations.createdAt
            })
            .from(schema.invitations)
            .where(inviteWhere)
      );
    };

    const [pc] = await db.select({ n: count() }).from(buildUnion().as("directory_union"));
    total = Number(pc?.n ?? 0);

    const unionRows = await buildUnion()
      .orderBy(...orderUnion)
      .limit(limit)
      .offset(offset);
    rows = unionRows.map((r) => ({
      kind: r.kind,
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      departmentId: r.departmentId,
      inviteStatus: r.inviteStatus,
      createdAt: r.createdAt
    }));
  }

  const departments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);
  const deptById = new Map(departments.map((d) => [d.id, d.name]));

  const bodyRows = rows.map((r) => {
    const deptLabel = r.departmentId
      ? deptById.get(r.departmentId) ?? "Unknown"
      : "Unassigned";
    if (r.kind === "invite") {
      return {
        kind: "invite" as const,
        id: r.id,
        email: r.email,
        department: deptLabel,
        createdAt: r.createdAt?.toISOString() ?? null
      };
    }
    return {
      kind: "user" as const,
      id: r.id,
      name: r.name ?? "",
      email: r.email,
      role: r.role,
      department: deptLabel,
      inviteStatus: r.inviteStatus ?? "accepted",
      createdAt: r.createdAt?.toISOString() ?? null
    };
  });

  const userIds = bodyRows
    .filter((r): r is (typeof bodyRows)[number] & { kind: "user" } => r.kind === "user")
    .map((r) => r.id);

  const assignmentByUserId = new Map<number, Array<{ projectId: number; label: string }>>();
  if (userIds.length > 0) {
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
      .innerJoin(
        schema.clients,
        eq(schema.employeeClientProjectAssignments.clientId, schema.clients.id)
      )
      .where(inArray(schema.employeeClientProjectAssignments.userId, userIds));

    for (const a of assignments) {
      const list = assignmentByUserId.get(a.userId) ?? [];
      list.push({
        projectId: a.projectId,
        label: `${a.clientName} — ${a.projectName}`
      });
      assignmentByUserId.set(a.userId, list);
    }
  }

  const projectOptionsRows = await db
    .select({
      projectId: schema.clientProjects.id,
      projectName: schema.clientProjects.name,
      clientName: schema.clients.name
    })
    .from(schema.clientProjects)
    .innerJoin(schema.clients, eq(schema.clientProjects.clientId, schema.clients.id))
    .orderBy(asc(schema.clients.name), asc(schema.clientProjects.name));

  const clientProjectOptions = projectOptionsRows.map((p) => ({
    projectId: p.projectId,
    label: `${p.clientName} — ${p.projectName}`
  }));

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return okJson(ctx, {
      rows: bodyRows.map((row) =>
        row.kind === "user"
          ? {
              ...row,
              assignedClientProjects: assignmentByUserId.get(row.id) ?? []
            }
          : row
      ),
      total,
      page,
      limit,
      totalPages,
      departments,
      clientProjectOptions,
      viewerUserId: payload.userId
    });
  });
}
