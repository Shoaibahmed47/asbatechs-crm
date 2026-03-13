import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  date,
  jsonb
} from "drizzle-orm/pg-core";

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
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  totalWorkMinutes: integer("total_work_minutes").default(0),
  totalBreakMinutes: integer("total_break_minutes").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const breakSessions = pgTable("break_sessions", {
  id: serial("id").primaryKey(),
  attendanceLogId: integer("attendance_log_id")
    .notNull()
    .references(() => attendanceLogs.id),
  breakStart: timestamp("break_start", { withTimezone: true }).notNull(),
  breakEnd: timestamp("break_end", { withTimezone: true })
});

export const hotLeads = pgTable("hot_leads", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  source: text("source"),
  departmentId: integer("department_id").references(() => departments.id),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  status: text("status").notNull(),
  notesSummary: text("notes_summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const saleLeads = pgTable("sale_leads", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  departmentId: integer("department_id").references(() => departments.id),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  saleAmount: numeric("sale_amount", { precision: 12, scale: 2 }),
  servicePurchased: text("service_purchased"),
  notesSummary: text("notes_summary"),
  dateOfSale: date("date_of_sale"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  leadType: text("lead_type").notNull(),
  authorUserId: integer("author_user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
});

