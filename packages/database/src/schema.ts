import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  date,
  boolean,
  jsonb,
  uniqueIndex
} from "drizzle-orm/pg-core";

/** Files uploaded with a client work update (drag & drop). */
export type ClientWorkAttachment = {
  fileName: string;
  storagePath: string;
  mimeType: string;
};

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  supabaseAuthId: text("supabase_auth_id").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  /** Latest employee-invite token (optional; invitations table is source for pending invites). */
  inviteToken: text("invite_token").unique(),
  /** pending = invited, not finished signup; accepted = full account */
  inviteStatus: text("invite_status").notNull().default("accepted"),
  resetToken: text("reset_token").unique(),
  resetTokenExpiry: timestamp("reset_token_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * Attendance row for one user per calendar day.
 * Conceptual model (matches product spec):
 * - attendance: id, user_id, clock_in, clock_out, total_hours, status
 * DB table name remains `attendance_logs` for migration continuity.
 */
export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  totalWorkMinutes: integer("total_work_minutes").default(0),
  totalBreakMinutes: integer("total_break_minutes").default(0),
  /** Persisted snapshot: active | break | offline (kept in sync on each action). */
  status: text("status").notNull().default("offline"),
  /** Total worked hours when shift is complete (set on clock-out). */
  totalHours: numeric("total_hours", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * Break intervals for an attendance row.
 * Conceptual model: breaks.id, attendance_id, break_start, break_end
 */
export const breakSessions = pgTable("break_sessions", {
  id: serial("id").primaryKey(),
  attendanceLogId: integer("attendance_log_id")
    .notNull()
    .references(() => attendanceLogs.id),
  breakStart: timestamp("break_start", { withTimezone: true }).notNull(),
  breakEnd: timestamp("break_end", { withTimezone: true })
});

/**
 * Unified leads: hot pipeline + closed sales in one table.
 * type: `hot` | `sale`
 * Sale-only: sale_amount, service_purchased, sale_date
 */
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  source: text("source"),
  departmentId: integer("department_id").references(() => departments.id),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  status: text("status").notNull(),
  notesSummary: text("notes_summary"),
  nextFollowUpDate: date("next_follow_up_date"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  saleAmount: numeric("sale_amount", { precision: 12, scale: 2 }),
  servicePurchased: text("service_purchased"),
  saleDate: date("sale_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  leadId: integer("lead_id").references(() => leads.id),
  message: text("message").notNull(),
  dueDate: date("due_date"),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const leadAttachments = pgTable("lead_attachments", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false)
});

/**
 * Per-lead discussion thread (not embedded in `leads.notes_summary`).
 * Spec: id, lead_id, user_id, note, created_at
 */
export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/**
 * Audit trail. entity_type: lead | user
 * Spec: id, user_id, action, entity_type, entity_id, created_at
 */
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  token: text("token").notNull().unique(),
  invitedByUserId: integer("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/** Portal users (separate from internal CRM users). Invited by admin only. */
export const clientInvitations = pgTable("client_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedByUserId: integer("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const clientProjects = pgTable("client_projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * Admin-side assignment of internal employees to client projects.
 * One active project per user (Phase 1), can be expanded later.
 */
export const employeeClientProjectAssignments = pgTable(
  "employee_client_project_assignments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: integer("project_id")
      .notNull()
      .references(() => clientProjects.id, { onDelete: "cascade" }),
    assignedByUserId: integer("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
  },
  (table) => ({
    uniqueUserProject: uniqueIndex("employee_client_project_assignments_user_project_unique").on(
      table.userId,
      table.projectId
    )
  })
);

/** Client-submitted work updates (links, repo, docs, screenshot URL). */
export const clientWorkUpdates = pgTable("client_work_updates", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => clientProjects.id, {
    onDelete: "set null"
  }),
  title: text("title").notNull(),
  notes: text("notes"),
  screenshotUrl: text("screenshot_url"),
  gitRepoUrl: text("git_repo_url"),
  documentUrl: text("document_url"),
  linkUrl: text("link_url"),
  /** submitted | in_review | changes_requested | approved */
  status: text("status").notNull().default("submitted"),
  attachments: jsonb("attachments")
    .$type<ClientWorkAttachment[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const clientWorkComments = pgTable("client_work_comments", {
  id: serial("id").primaryKey(),
  workUpdateId: integer("work_update_id")
    .notNull()
    .references(() => clientWorkUpdates.id, { onDelete: "cascade" }),
  actorType: text("actor_type").notNull(),
  actorUserId: integer("actor_user_id").references(() => users.id, {
    onDelete: "set null"
  }),
  actorClientId: integer("actor_client_id").references(() => clients.id, {
    onDelete: "set null"
  }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});
