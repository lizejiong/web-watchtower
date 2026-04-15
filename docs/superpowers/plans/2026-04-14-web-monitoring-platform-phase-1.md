# Web Monitoring Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working slice of the platform: monorepo foundation, browser SDK core, ingest API with idempotent batch writes, release metadata storage, issue grouping worker, playground app, and dashboard authentication skeleton.

**Architecture:** Use a `pnpm` + `Turborepo` monorepo with separate apps for `dashboard`, `ingest-api`, `worker`, and `playground-react`. Put event schemas, database access, SDK code, and GitHub/AI placeholders into packages with clear boundaries. Implement ingest as an at-least-once protocol with server-side dedupe and move issue grouping into a background worker.

**Tech Stack:** `Node.js 24`, `TypeScript`, `pnpm`, `Turborepo`, `Fastify`, `Drizzle ORM`, `Supabase Postgres`, `Vitest`, `Playwright`, `Next.js`, `React`, `IndexedDB`

---

### Task 1: Scaffold the Monorepo and Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `apps/dashboard/package.json`
- Create: `apps/ingest-api/package.json`
- Create: `apps/worker/package.json`
- Create: `apps/playground-react/package.json`
- Create: `packages/shared/package.json`
- Create: `packages/db/package.json`
- Create: `packages/sdk-web/package.json`
- Create: `packages/ai/package.json`
- Create: `packages/github/package.json`
- Test: `pnpm-workspace.yaml`, `package.json`

- [x] **Step 1: Create the root workspace files**

```json
{
  "name": "web-monitoring",
  "private": true,
  "packageManager": "pnpm@10.12.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.12",
    "typescript": "^5.8.3"
  }
}
```

```yaml
packages:
  - apps/*
  - packages/*
```

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": ["coverage/**"]
    }
  }
}
```

- [x] **Step 2: Add shared TypeScript and ignore files**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@web-monitoring/shared/*": ["packages/shared/src/*"],
      "@web-monitoring/db/*": ["packages/db/src/*"],
      "@web-monitoring/sdk-web/*": ["packages/sdk-web/src/*"]
    }
  }
}
```

```gitignore
node_modules/
pnpm-lock.yaml
.next/
dist/
coverage/
.turbo/
.env
.env.*
supabase/.temp/
playwright-report/
```

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

- [x] **Step 3: Add package manifests for apps and packages**

```json
{
  "name": "@web-monitoring/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

```json
{
  "name": "@web-monitoring/ingest-api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  }
}
```

```json
{
  "name": "@web-monitoring/playground-react",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [x] **Step 4: Install dependencies and verify workspace wiring**

Run: `pnpm install`
Expected: install completes and creates a lockfile without workspace resolution errors.

Run: `pnpm build`
Expected: workspace tasks run, even if some packages are still skeletons.

- [x] **Step 5: Commit**

```bash
git init
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .npmrc apps packages
git commit -m "chore: scaffold monorepo foundation"
```

### Task 2: Define Shared Event Schemas and Protocol Contracts

**Files:**
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/rules.ts`
- Test: `packages/shared/src/events.test.ts`

- [x] **Step 1: Write the failing schema contract tests**

```ts
import { describe, expect, it } from "vitest"
import { eventEnvelopeSchema, batchIngestResponseSchema } from "./events"

describe("eventEnvelopeSchema", () => {
  it("accepts a valid error event", () => {
    const parsed = eventEnvelopeSchema.parse({
      id: "evt_1",
      batchId: "bat_1",
      type: "error",
      schemaVersion: 1,
      timestamp: Date.now(),
      projectId: "proj_1",
      appId: "app_1",
      sessionId: "sess_1",
      url: "https://example.com/page",
      tags: {},
      context: {},
      payload: { message: "boom" },
    })

    expect(parsed.id).toBe("evt_1")
  })

  it("rejects unknown top-level event types", () => {
    expect(() =>
      eventEnvelopeSchema.parse({
        id: "evt_2",
        batchId: "bat_1",
        type: "made-up",
        schemaVersion: 1,
        timestamp: Date.now(),
        projectId: "proj_1",
        appId: "app_1",
        sessionId: "sess_1",
        url: "https://example.com/page",
        tags: {},
        context: {},
        payload: {},
      })
    ).toThrow()
  })
})

describe("batchIngestResponseSchema", () => {
  it("accepts partial success responses", () => {
    const parsed = batchIngestResponseSchema.parse({
      batchId: "bat_1",
      accepted: ["evt_1"],
      duplicated: ["evt_2"],
      rejected: [{ eventId: "evt_3", reason: "payload_too_large", retryable: false }],
    })

    expect(parsed.rejected[0]?.retryable).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/shared test`
Expected: FAIL with module or schema symbol not found errors.

- [x] **Step 3: Implement the shared schemas and types**

```ts
import { z } from "zod"

export const eventTypeSchema = z.enum([
  "error",
  "performance",
  "request",
  "behavior",
  "breadcrumb",
  "custom",
])

export const eventEnvelopeSchema = z.object({
  id: z.string().min(1),
  batchId: z.string().min(1),
  type: eventTypeSchema,
  name: z.string().min(1).optional(),
  schemaVersion: z.number().int().positive(),
  timestamp: z.number().int().positive(),
  projectId: z.string().min(1),
  appId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  release: z.string().min(1).optional(),
  env: z.string().min(1).optional(),
  sampling: z
    .object({
      sampleRate: z.number().min(0).max(1),
      sampled: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
  trace: z
    .object({
      traceId: z.string().optional(),
      spanId: z.string().optional(),
      requestId: z.string().optional(),
    })
    .optional(),
  url: z.string().url(),
  route: z.string().optional(),
  tags: z.record(z.string(), z.string()),
  context: z.record(z.string(), z.unknown()),
  payload: z.record(z.string(), z.unknown()),
})

export const batchIngestRequestSchema = z.object({
  batchId: z.string().min(1),
  sentAt: z.number().int().positive(),
  events: z.array(eventEnvelopeSchema).min(1).max(500),
})

export const batchIngestResponseSchema = z.object({
  batchId: z.string().min(1),
  accepted: z.array(z.string()),
  duplicated: z.array(z.string()),
  rejected: z.array(
    z.object({
      eventId: z.string().min(1),
      reason: z.string().min(1),
      retryable: z.boolean(),
    })
  ),
})

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>
export type BatchIngestRequest = z.infer<typeof batchIngestRequestSchema>
export type BatchIngestResponse = z.infer<typeof batchIngestResponseSchema>
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @web-monitoring/shared test`
Expected: PASS for schema contract tests.

- [x] **Step 5: Commit**

```bash
git add packages/shared
git commit -m "feat: add shared telemetry protocol schemas"
```
### Task 3: Add Database Schema and Migration Tooling

**Files:**
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/queries/events.ts`
- Test: `packages/db/src/schema.test.ts`

- [x] **Step 1: Write the failing schema shape tests**

```ts
import { describe, expect, it } from "vitest"
import { tables } from "./schema"

describe("database schema", () => {
  it("defines event and issue tables", () => {
    expect(tables.events).toBeDefined()
    expect(tables.issues).toBeDefined()
    expect(tables.projectApiKeys).toBeDefined()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/db test`
Expected: FAIL because the schema module does not exist yet.

- [x] **Step 3: Implement the Drizzle schema for Phase 1 tables**

```ts
import { pgEnum, pgTable, text, timestamp, uuid, jsonb, integer, uniqueIndex } from "drizzle-orm/pg-core"

export const apiKeyStatusEnum = pgEnum("api_key_status", ["active", "rotating", "disabled", "expired"])

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const apps = pgTable("apps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const projectApiKeys = pgTable("project_api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  appId: uuid("app_id").notNull().references(() => apps.id),
  keyHash: text("key_hash").notNull(),
  status: apiKeyStatusEnum("status").default("active").notNull(),
  allowedOrigins: jsonb("allowed_origins").$type<string[]>().default([]).notNull(),
  hourlyQuota: integer("hourly_quota").notNull(),
  dailyQuota: integer("daily_quota").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
})

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    appId: uuid("app_id").notNull().references(() => apps.id),
    eventId: text("event_id").notNull(),
    batchId: text("batch_id").notNull(),
    type: text("type").notNull(),
    sessionId: text("session_id").notNull(),
    release: text("release"),
    route: text("route"),
    payload: jsonb("payload").notNull(),
    tags: jsonb("tags").notNull(),
    context: jsonb("context").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dedupe: uniqueIndex("events_project_app_event_id_idx").on(table.projectId, table.appId, table.eventId),
  })
)

export const issues = pgTable("issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  appId: uuid("app_id").notNull().references(() => apps.id),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("open"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  occurrences: integer("occurrences").notNull().default(0),
})

export const releaseArtifacts = pgTable("release_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  appId: uuid("app_id").notNull().references(() => apps.id),
  release: text("release").notNull(),
  commitSha: text("commit_sha").notNull(),
  repository: text("repository").notNull(),
  sourceMapStatus: text("source_map_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const tables = { projects, apps, projectApiKeys, events, issues, releaseArtifacts }
```

- [x] **Step 4: Run tests and generate the first migration**

Run: `pnpm --filter @web-monitoring/db test`
Expected: PASS.

Run: `pnpm --filter @web-monitoring/db drizzle-kit generate`
Expected: a migration file is generated for the Phase 1 schema.

- [x] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat: add phase 1 database schema"
```

### Task 4: Build the Ingest API Skeleton with Health and Auth Checks

**Files:**
- Create: `apps/ingest-api/tsconfig.json`
- Create: `apps/ingest-api/src/app.ts`
- Create: `apps/ingest-api/src/server.ts`
- Create: `apps/ingest-api/src/config.ts`
- Create: `apps/ingest-api/src/routes/health.ts`
- Create: `apps/ingest-api/src/routes/ingest.ts`
- Create: `apps/ingest-api/src/plugins/auth.ts`
- Test: `apps/ingest-api/src/routes/health.test.ts`
- Test: `apps/ingest-api/src/routes/ingest-auth.test.ts`

- [x] **Step 1: Write failing API tests for health and missing key rejection**

```ts
import { describe, expect, it } from "vitest"
import { buildApp } from "../app"

describe("health route", () => {
  it("returns ok", async () => {
    const app = buildApp()
    const response = await app.inject({ method: "GET", url: "/health" })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: "ok" })
  })
})

describe("ingest auth", () => {
  it("rejects missing write key", async () => {
    const app = buildApp()
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ingest/batches",
      payload: { batchId: "bat_1", sentAt: Date.now(), events: [] },
    })

    expect(response.statusCode).toBe(401)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/ingest-api test`
Expected: FAIL because the Fastify app and routes do not exist yet.

- [x] **Step 3: Implement the Fastify app, health route, and write-key guard**

```ts
import Fastify from "fastify"
import { batchIngestRequestSchema } from "@web-monitoring/shared/events"

export function buildApp() {
  const app = Fastify({ logger: true })

  app.get("/health", async () => ({ status: "ok" }))

  app.post("/api/v1/ingest/batches", async (request, reply) => {
    const writeKey = request.headers["x-write-key"]

    if (typeof writeKey !== "string" || writeKey.length === 0) {
      return reply.code(401).send({ error: "missing_write_key" })
    }

    const parsed = batchIngestRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_batch" })
    }

    return reply.code(202).send({ batchId: parsed.data.batchId, accepted: [], duplicated: [], rejected: [] })
  })

  return app
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @web-monitoring/ingest-api test`
Expected: PASS for the health and auth tests.

- [x] **Step 5: Commit**

```bash
git add apps/ingest-api
git commit -m "feat: add ingest api skeleton"
```

### Task 5: Implement Idempotent Batch Ingestion and Partial Success Responses

**Files:**
- Modify: `apps/ingest-api/src/routes/ingest.ts`
- Create: `apps/ingest-api/src/services/ingest-service.ts`
- Create: `apps/ingest-api/src/services/key-service.ts`
- Create: `apps/ingest-api/src/services/rate-limit-service.ts`
- Test: `apps/ingest-api/src/routes/ingest-batch.test.ts`
- Test: `apps/ingest-api/src/services/ingest-service.test.ts`

- [x] **Step 1: Write failing tests for accepted, duplicated, and rejected events**

```ts
import { describe, expect, it, vi } from "vitest"
import { ingestBatch } from "./ingest-service"

describe("ingestBatch", () => {
  it("returns duplicated when the same eventId already exists", async () => {
    const db = {
      insertEvent: vi.fn()
        .mockResolvedValueOnce({ status: "accepted" })
        .mockResolvedValueOnce({ status: "duplicated" }),
    }

    const response = await ingestBatch(db as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [
        { id: "evt_1", batchId: "bat_1", projectId: "proj", appId: "app", type: "error" },
        { id: "evt_1", batchId: "bat_1", projectId: "proj", appId: "app", type: "error" },
      ],
    } as never)

    expect(response.accepted).toEqual(["evt_1"])
    expect(response.duplicated).toEqual(["evt_1"])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/ingest-api test -- ingest-service`
Expected: FAIL because the ingest service does not implement dedupe behavior yet.

- [x] **Step 3: Implement batch persistence semantics**

```ts
import type { BatchIngestRequest, BatchIngestResponse, EventEnvelope } from "@web-monitoring/shared/events"

export async function ingestBatch(
  repository: { insertEvent: (event: EventEnvelope) => Promise<{ status: "accepted" | "duplicated" }> },
  batch: BatchIngestRequest
): Promise<BatchIngestResponse> {
  const accepted: string[] = []
  const duplicated: string[] = []
  const rejected: Array<{ eventId: string; reason: string; retryable: boolean }> = []

  for (const event of batch.events) {
    if (event.id !== event.batchId && event.id.length > 0) {
      const result = await repository.insertEvent(event)
      if (result.status === "accepted") {
        accepted.push(event.id)
      } else {
        duplicated.push(event.id)
      }
      continue
    }

    rejected.push({ eventId: event.id, reason: "invalid_event_id", retryable: false })
  }

  return {
    batchId: batch.batchId,
    accepted,
    duplicated,
    rejected,
  }
}
```

- [x] **Step 4: Run the service and route tests**

Run: `pnpm --filter @web-monitoring/ingest-api test`
Expected: PASS for idempotent batch handling and partial success cases.

- [x] **Step 5: Commit**

```bash
git add apps/ingest-api
git commit -m "feat: add idempotent batch ingest semantics"
```
### Task 6: Implement Release Metadata Storage and Issue Grouping Worker

**Files:**
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/worker.ts`
- Create: `apps/worker/src/jobs/group-issue.ts`
- Create: `apps/worker/src/lib/fingerprint.ts`
- Create: `apps/worker/src/lib/queue.ts`
- Create: `apps/ingest-api/src/services/job-publisher.ts`
- Test: `apps/worker/src/lib/fingerprint.test.ts`
- Test: `apps/worker/src/jobs/group-issue.test.ts`

- [x] **Step 1: Write failing tests for fingerprint normalization and issue upsert**

```ts
import { describe, expect, it } from "vitest"
import { buildErrorFingerprint } from "../lib/fingerprint"

describe("buildErrorFingerprint", () => {
  it("normalizes dynamic ids from error messages", () => {
    const fingerprint = buildErrorFingerprint({
      type: "error",
      route: "/orders/123",
      payload: {
        message: "Order 998877 failed",
        stack: "Error: Order 998877 failed\n at checkout (app.ts:1:1)",
      },
      release: "web@abc123",
    } as never)

    expect(fingerprint).toContain("/orders/:id")
    expect(fingerprint).not.toContain("998877")
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/worker test`
Expected: FAIL because the worker job and fingerprint helper do not exist yet.

- [x] **Step 3: Implement queue publishing and issue grouping**

```ts
export function normalizeRoute(route?: string) {
  return route?.replace(/\/\d+/g, "/:id") ?? "/unknown"
}

export function normalizeMessage(message?: string) {
  return (message ?? "unknown_error").replace(/\b\d{3,}\b/g, ":num")
}

export function buildErrorFingerprint(event: {
  route?: string
  release?: string
  payload: { message?: string; stack?: string }
}) {
  const firstFrame = event.payload.stack?.split("\n")[1]?.trim() ?? "no_frame"
  return [normalizeRoute(event.route), normalizeMessage(event.payload.message), firstFrame, event.release ?? "no_release"].join("::")
}
```

```ts
export async function groupIssue(
  repository: {
    findIssueByFingerprint: (fingerprint: string) => Promise<{ id: string; occurrences: number } | null>
    insertIssue: (fingerprint: string, eventId: string) => Promise<void>
    incrementIssue: (issueId: string, eventId: string) => Promise<void>
  },
  event: { id: string; type: string; route?: string; release?: string; payload: { message?: string; stack?: string } }
) {
  const fingerprint = buildErrorFingerprint(event)
  const issue = await repository.findIssueByFingerprint(fingerprint)

  if (!issue) {
    await repository.insertIssue(fingerprint, event.id)
    return
  }

  await repository.incrementIssue(issue.id, event.id)
}
```

- [x] **Step 4: Run worker tests**

Run: `pnpm --filter @web-monitoring/worker test`
Expected: PASS for fingerprint normalization and issue grouping.

- [x] **Step 5: Commit**

```bash
git add apps/worker apps/ingest-api/src/services/job-publisher.ts
git commit -m "feat: add issue grouping worker"
```

### Task 7: Implement SDK Core, Local Queue, and Sampling

**Files:**
- Create: `packages/sdk-web/tsconfig.json`
- Create: `packages/sdk-web/src/index.ts`
- Create: `packages/sdk-web/src/init.ts`
- Create: `packages/sdk-web/src/config.ts`
- Create: `packages/sdk-web/src/queue/memory-queue.ts`
- Create: `packages/sdk-web/src/queue/indexeddb-queue.ts`
- Create: `packages/sdk-web/src/sampling.ts`
- Test: `packages/sdk-web/src/sampling.test.ts`
- Test: `packages/sdk-web/src/queue/memory-queue.test.ts`

- [x] **Step 1: Write failing tests for sampling and queue overflow behavior**

```ts
import { describe, expect, it } from "vitest"
import { shouldSampleEvent } from "../sampling"
import { MemoryQueue } from "./memory-queue"

describe("shouldSampleEvent", () => {
  it("always keeps error events at sample rate 1", () => {
    expect(shouldSampleEvent("error", 1)).toBe(true)
  })
})

describe("MemoryQueue", () => {
  it("drops oldest breadcrumb before dropping errors", () => {
    const queue = new MemoryQueue(2)

    queue.push({ id: "b1", type: "breadcrumb" } as never)
    queue.push({ id: "e1", type: "error" } as never)
    queue.push({ id: "e2", type: "error" } as never)

    expect(queue.items().map((item) => item.id)).toEqual(["e1", "e2"])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/sdk-web test`
Expected: FAIL because the SDK core modules do not exist yet.

- [x] **Step 3: Implement SDK config, sampling, and queue primitives**

```ts
export type EventType = "error" | "performance" | "request" | "behavior" | "breadcrumb" | "custom"

const priority: Record<EventType, number> = {
  error: 5,
  request: 4,
  performance: 3,
  behavior: 2,
  breadcrumb: 1,
  custom: 2,
}

export function shouldSampleEvent(type: EventType, sampleRate: number, random = Math.random()) {
  if (type === "error") return true
  return random <= sampleRate
}

export class MemoryQueue<T extends { id: string; type: EventType }> {
  private readonly events: T[] = []

  constructor(private readonly maxSize: number) {}

  push(event: T) {
    this.events.push(event)
    while (this.events.length > this.maxSize) {
      const lowestPriorityIndex = this.events.reduce(
        (lowest, current, index, array) =>
          priority[current.type] < priority[array[lowest]!.type] ? index : lowest,
        0
      )
      this.events.splice(lowestPriorityIndex, 1)
    }
  }

  items() {
    return [...this.events]
  }
}
```

- [x] **Step 4: Run SDK tests**

Run: `pnpm --filter @web-monitoring/sdk-web test`
Expected: PASS for sampling and queue behavior.

- [x] **Step 5: Commit**

```bash
git add packages/sdk-web
git commit -m "feat: add sdk core queue and sampling"
```

### Task 8: Implement SDK Batch Transport, Partial Success Handling, and IndexedDB Replay

**Files:**
- Modify: `packages/sdk-web/src/index.ts`
- Create: `packages/sdk-web/src/transport/batch-transport.ts`
- Create: `packages/sdk-web/src/retry.ts`
- Create: `packages/sdk-web/src/events/error.ts`
- Test: `packages/sdk-web/src/transport/batch-transport.test.ts`
- Test: `packages/sdk-web/src/retry.test.ts`

- [x] **Step 1: Write failing tests for accepted, duplicated, retryable, and non-retryable outcomes**

```ts
import { describe, expect, it, vi } from "vitest"
import { flushBatch } from "./batch-transport"

describe("flushBatch", () => {
  it("keeps only retryable rejected events for replay", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        batchId: "bat_1",
        accepted: ["evt_1"],
        duplicated: ["evt_2"],
        rejected: [
          { eventId: "evt_3", reason: "temporarily_unavailable", retryable: true },
          { eventId: "evt_4", reason: "payload_too_large", retryable: false },
        ],
      }),
    })

    const result = await flushBatch(fetcher as never, {
      batchId: "bat_1",
      sentAt: Date.now(),
      events: [
        { id: "evt_1" },
        { id: "evt_2" },
        { id: "evt_3" },
        { id: "evt_4" },
      ],
    } as never)

    expect(result.retryableEventIds).toEqual(["evt_3"])
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/sdk-web test -- batch-transport`
Expected: FAIL because the transport does not interpret partial success responses yet.

- [x] **Step 3: Implement transport and retry filtering**

```ts
import type { BatchIngestRequest, BatchIngestResponse } from "@web-monitoring/shared/events"

export async function flushBatch(
  fetcher: (input: RequestInfo, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<BatchIngestResponse> }>,
  batch: BatchIngestRequest,
) {
  const response = await fetcher("/api/v1/ingest/batches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(batch),
  })

  if (!response.ok) {
    return { retryableEventIds: batch.events.map((event) => event.id) }
  }

  const parsed = await response.json()
  return {
    retryableEventIds: parsed.rejected.filter((item) => item.retryable).map((item) => item.eventId),
    droppedEventIds: parsed.rejected.filter((item) => !item.retryable).map((item) => item.eventId),
    acceptedEventIds: parsed.accepted,
    duplicatedEventIds: parsed.duplicated,
  }
}
```

- [x] **Step 4: Run SDK transport tests**

Run: `pnpm --filter @web-monitoring/sdk-web test`
Expected: PASS for transport and retry behavior.

- [x] **Step 5: Commit**

```bash
git add packages/sdk-web
git commit -m "feat: add sdk batch transport semantics"
```
### Task 9: Add the Playground App for End-to-End Manual Validation

**Files:**
- Create: `apps/playground-react/index.html`
- Create: `apps/playground-react/src/main.tsx`
- Create: `apps/playground-react/src/App.tsx`
- Create: `apps/playground-react/src/api.ts`
- Create: `apps/playground-react/src/routes.tsx`
- Test: `apps/playground-react/src/App.test.tsx`
- Test: `apps/playground-react/e2e/playground.spec.ts`

- [x] **Step 1: Write failing UI tests for trigger buttons**

```tsx
import { render, screen } from "@testing-library/react"
import { App } from "./App"

it("shows controls for manual telemetry triggers", async () => {
  render(<App />)

  expect(screen.getByRole("button", { name: "Throw Runtime Error" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Send Failed Request" })).toBeInTheDocument()
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/playground-react test`
Expected: FAIL because the app does not exist yet.

- [x] **Step 3: Implement the trigger UI and SDK bootstrapping**

```tsx
import { useState } from "react"

export function App() {
  const [inputValue, setInputValue] = useState("")

  return (
    <main>
      <h1>Web Monitoring Playground</h1>
      <button onClick={() => { throw new Error("playground runtime error") }}>
        Throw Runtime Error
      </button>
      <button onClick={() => Promise.reject(new Error("playground rejection"))}>
        Trigger Promise Rejection
      </button>
      <button onClick={() => fetch("/api/fail").catch(() => undefined)}>
        Send Failed Request
      </button>
      <button onClick={() => window.dispatchEvent(new Event("offline"))}>
        Simulate Offline
      </button>
      <input
        aria-label="Search Input"
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
      />
    </main>
  )
}
```

- [x] **Step 4: Run playground tests and one E2E flow**

Run: `pnpm --filter @web-monitoring/playground-react test`
Expected: PASS.

Run: `pnpm exec playwright test apps/playground-react/e2e/playground.spec.ts`
Expected: PASS for basic trigger rendering and click flow.

- [x] **Step 5: Commit**

```bash
git add apps/playground-react
git commit -m "feat: add sdk playground app"
```

### Task 10: Add the Dashboard Authentication Skeleton and Project Scope Guards

**Files:**
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/app/login/page.tsx`
- Create: `apps/dashboard/app/projects/[projectId]/page.tsx`
- Create: `apps/dashboard/lib/auth.ts`
- Create: `apps/dashboard/lib/server-client.ts`
- Test: `apps/dashboard/lib/auth.test.ts`

- [x] **Step 1: Write failing auth guard tests**

```ts
import { describe, expect, it } from "vitest"
import { canAccessProject } from "./auth"

describe("canAccessProject", () => {
  it("allows org_admin on any project", () => {
    expect(canAccessProject({ role: "org_admin", projectIds: [] }, "proj_1")).toBe(true)
  })

  it("denies viewer outside assigned projects", () => {
    expect(canAccessProject({ role: "viewer", projectIds: ["proj_2"] }, "proj_1")).toBe(false)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @web-monitoring/dashboard test`
Expected: FAIL because the auth helper does not exist yet.

- [x] **Step 3: Implement auth helpers and the first protected project page**

```ts
export type DashboardRole = "org_admin" | "project_admin" | "developer" | "viewer"

export function canAccessProject(
  member: { role: DashboardRole; projectIds: string[] },
  projectId: string,
) {
  if (member.role === "org_admin") return true
  return member.projectIds.includes(projectId)
}
```

```tsx
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const member = { role: "viewer" as const, projectIds: ["demo-project"] }

  if (!canAccessProject(member, projectId)) {
    return <div>Forbidden</div>
  }

  return <div>Project: {projectId}</div>
}
```

- [x] **Step 4: Run dashboard tests**

Run: `pnpm --filter @web-monitoring/dashboard test`
Expected: PASS for the auth helper.

Run: `pnpm --filter @web-monitoring/dashboard build`
Expected: PASS for the Next.js app skeleton.

- [x] **Step 5: Commit**

```bash
git add apps/dashboard
git commit -m "feat: add dashboard auth skeleton"
```

### Task 11: Verify the Phase 1 Slice End-to-End

**Files:**
- Modify: `apps/playground-react/e2e/playground.spec.ts`
- Modify: `apps/ingest-api/src/routes/ingest-batch.test.ts`
- Modify: `apps/worker/src/jobs/group-issue.test.ts`
- Test: `apps/playground-react/e2e/playground.spec.ts`

- [ ] **Step 1: Add a failing end-to-end test for runtime error ingestion**

```ts
import { test, expect } from "@playwright/test"

test("runtime error appears in ingest flow", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173")
  await page.getByRole("button", { name: "Throw Runtime Error" }).click()
  await expect(page.getByText("Last flush: success")).toBeVisible()
})
```

- [ ] **Step 2: Run the failing verification command**

Run: `pnpm test`
Expected: FAIL because the end-to-end path is not fully wired yet.

- [ ] **Step 3: Complete missing glue code and scripts needed for the phase**

```json
{
  "scripts": {
    "dev:phase1": "turbo run dev --filter=@web-monitoring/ingest-api --filter=@web-monitoring/worker --filter=@web-monitoring/playground-react --filter=@web-monitoring/dashboard",
    "test:e2e": "playwright test"
  }
}
```

```ts
export function formatFlushStatus(result: { acceptedEventIds: string[]; duplicatedEventIds: string[] }) {
  const total = result.acceptedEventIds.length + result.duplicatedEventIds.length
  return total > 0 ? "success" : "noop"
}
```

- [ ] **Step 4: Run the verification suite**

Run: `pnpm lint`
Expected: PASS.

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm test`
Expected: PASS.

Run: `pnpm test:e2e`
Expected: PASS for the playground runtime error flow.

- [ ] **Step 5: Commit**

```bash
git add package.json apps packages
git commit -m "chore: verify phase 1 telemetry slice"
```

## Self-Review Checklist

- Spec coverage:
  - Monorepo scaffold: Task 1
  - Shared protocol, `batchId`, `eventId`, partial success semantics: Tasks 2, 5, 8
  - Database tables and release metadata: Task 3
  - Ingest API, write-key auth, dedupe: Tasks 4, 5
  - Worker issue grouping: Task 6
  - SDK core, sampling, queue, offline replay: Tasks 7, 8
  - Playground validation target: Task 9
  - Dashboard auth and project scope skeleton: Task 10
  - Phase-level verification: Task 11
- Placeholder scan:
  - No `TODO`, `TBD`, or deferred implementation markers remain.
- Type consistency:
  - `eventId` is represented as `EventEnvelope.id`
  - `batchId` is present in shared schema, ingest protocol, and retry logic
  - Dashboard roles match the approved spec: `org_admin`, `project_admin`, `developer`, `viewer`
