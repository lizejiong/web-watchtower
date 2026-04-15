import { sql } from "drizzle-orm"
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

/** 项目写入 key 的状态枚举。 */
export const apiKeyStatusEnum = pgEnum("api_key_status", [
  "active",
  "rotating",
  "disabled",
  "expired",
])

/** 监控项目表。 */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/** 项目下的应用表。 */
export const apps = pgTable("apps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/** 项目公开写入 key 表。 */
export const projectApiKeys = pgTable("project_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id),
  keyHash: text("key_hash").notNull(),
  status: apiKeyStatusEnum("status").default("active").notNull(),
  allowedOrigins: jsonb("allowed_origins")
    .$type<string[]>()
    .default(sql`'[]'::jsonb`)
    .notNull(),
  hourlyQuota: integer("hourly_quota").notNull(),
  dailyQuota: integer("daily_quota").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
})

/** 原始遥测事件表。 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    appId: uuid("app_id")
      .notNull()
      .references(() => apps.id),
    eventId: text("event_id").notNull(),
    batchId: text("batch_id").notNull(),
    type: text("type").notNull(),
    sessionId: text("session_id").notNull(),
    release: text("release"),
    route: text("route"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    tags: jsonb("tags").$type<Record<string, string>>().notNull(),
    context: jsonb("context").$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dedupe: uniqueIndex("events_project_app_event_id_idx").on(
      table.projectId,
      table.appId,
      table.eventId,
    ),
  }),
)

/** 归并后的 Issue 表。 */
export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("open"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  occurrences: integer("occurrences").notNull().default(0),
  lastEventId: text("last_event_id").notNull(),
}, (table) => ({
  fingerprintUnique: uniqueIndex("issues_project_app_fingerprint_idx").on(
    table.projectId,
    table.appId,
    table.fingerprint,
  ),
}))

/** 鍒嗙粍 issue 浠诲姟琛ㄣ€?*/
export const groupIssueJobs = pgTable("group_issue_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: text("event_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastError: text("last_error"),
})

/** 发布产物与 Source Map 元数据表。 */
export const releaseArtifacts = pgTable("release_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  appId: uuid("app_id")
    .notNull()
    .references(() => apps.id),
  release: text("release").notNull(),
  commitSha: text("commit_sha").notNull(),
  repository: text("repository").notNull(),
  sourceMapStatus: text("source_map_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

/** Phase 1 需要暴露给应用层的表集合。 */
export const tables = {
  projects,
  apps,
  projectApiKeys,
  events,
  issues,
  releaseArtifacts,
  groupIssueJobs,
}
