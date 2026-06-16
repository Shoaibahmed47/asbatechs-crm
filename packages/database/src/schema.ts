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
  /** Per-employee expected check-in (HH:mm). Null = use company office default. */
  expectedCheckInTime: text("expected_check_in_time"),
  /** Per-employee expected shift end / check-out (HH:mm). Null = use office default. */
  expectedShiftEndTime: text("expected_shift_end_time"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

/**
 * Attendance row for one user per calendar day.
 * Conceptual model (matches product spec):
 * - attendance: id, user_id, clock_in, clock_out, total_hours, status
 * DB table name remains `attendance_logs` for migration continuity.
 */
/** Singleton row: company office hours for attendance (expected check-in + shift end). */
export const attendanceOfficeSettings = pgTable("attendance_office_settings", {
  id: integer("id").primaryKey().default(1),
  /** Local time HH:mm — expected employee clock-in (e.g. 19:00 = 7:00 PM). */
  expectedCheckInTime: text("expected_check_in_time").notNull().default("19:00"),
  /** Local time HH:mm — official shift end (may be next day if before check-in time). */
  shiftEndTime: text("shift_end_time").notNull().default("16:00"),
  /** Minutes after expected check-in that do not count as late (e.g. 15). */
  lateGraceMinutes: integer("late_grace_minutes").notNull().default(15),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
    onDelete: "set null"
  })
});

export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  totalWorkMinutes: integer("total_work_minutes").default(0),
  totalBreakMinutes: integer("total_break_minutes").default(0),
  /** Accumulated minutes from auto-classified unscheduled idle sessions. */
  unscheduledIdleMinutes: integer("unscheduled_idle_minutes").default(0),
  /** Count of auto-classified unscheduled idle sessions. */
  idleEventsCount: integer("idle_events_count").default(0),
  /** Accumulated minutes where laptop was locked/sleep-like during shift. */
  sleepMinutes: integer("sleep_minutes").default(0),
  /** Count of sleep/lock auto-away events during shift. */
  sleepEventsCount: integer("sleep_events_count").default(0),
  /** Minutes away while attendance tab was closed/hidden beyond policy. */
  tabCloseMinutes: integer("tab_close_minutes").default(0),
  tabCloseEventsCount: integer("tab_close_events_count").default(0),
  /** Minutes away with no cursor movement beyond policy. */
  cursorAwayMinutes: integer("cursor_away_minutes").default(0),
  cursorAwayEventsCount: integer("cursor_away_events_count").default(0),
  /** Last known client/agent activity timestamp while shift is open. */
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  /** Source that reported the last activity (browser | agent). */
  lastActivitySource: text("last_activity_source"),
  /** Persisted snapshot: active | break | offline (kept in sync on each action). */
  status: text("status").notNull().default("offline"),
  /** Total worked hours when shift is complete (set on clock-out). */
  totalHours: numeric("total_hours", { precision: 8, scale: 2 }),
  /** Minutes after expected office check-in on first clock-in of the day. */
  lateMinutes: integer("late_minutes").default(0),
  /** Snapshot of expected check-in (HH:mm) used for late calculation. */
  expectedCheckInTime: text("expected_check_in_time"),
  /** Employee explanation for late arrival (submitted on a later day). */
  lateReason: text("late_reason"),
  lateReasonSubmittedAt: timestamp("late_reason_submitted_at", { withTimezone: true }),
  /** Minutes before expected shift end when employee clocked out early. */
  earlyLeaveMinutes: integer("early_leave_minutes").default(0),
  /** Snapshot of expected shift end (HH:mm) used for early-leave calculation. */
  expectedShiftEndTime: text("expected_shift_end_time"),
  /** Employee explanation for leaving before shift end (submitted on a later day). */
  earlyLeaveReason: text("early_leave_reason"),
  earlyLeaveReasonSubmittedAt: timestamp("early_leave_reason_submitted_at", {
    withTimezone: true
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

/** Employee-submitted reason for a working day with no clock-in. */
export const attendanceAbsenceRecords = pgTable(
  "attendance_absence_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date").notNull(),
    reason: text("reason").notNull(),
    reasonSubmittedAt: timestamp("reason_submitted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
  },
  (table) => ({
    userDateUnique: uniqueIndex("attendance_absence_records_user_date_idx").on(
      table.userId,
      table.date
    )
  })
);

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
  breakEnd: timestamp("break_end", { withTimezone: true }),
  /** manual = employee-started, unscheduled = system-classified idle. */
  breakType: text("break_type").notNull().default("manual"),
  /** For unscheduled breaks: idle | sleep. */
  unscheduledCause: text("unscheduled_cause"),
  /** Optional explanation captured when user returns from unscheduled idle. */
  returnReason: text("return_reason"),
  /** Employee break type: lunch, prayer, personal, etc. */
  breakCategory: text("break_category"),
  /** Note when break started (optional detail). */
  startNote: text("start_note"),
  /** Note when break ended (where they went / what they did). */
  endNote: text("end_note")
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
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  followUpTimezone: text("follow_up_timezone"),
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
  dueAt: timestamp("due_at", { withTimezone: true }),
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
  /** client | employee | admin */
  authorType: text("author_type").notNull().default("client"),
  authorUserId: integer("author_user_id").references(() => users.id, {
    onDelete: "set null"
  }),
  authorClientId: integer("author_client_id").references(() => clients.id, {
    onDelete: "set null"
  }),
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
