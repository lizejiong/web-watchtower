import { drizzle } from "drizzle-orm/pglite"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"

import { findWriteKeyByHash } from "./queries/api-keys"
import { countProjectEventsSince, insertEventWithDedupe } from "./queries/events"
import {
  claimNextGroupIssueJob,
  completeGroupIssueJob,
  enqueueGroupIssueJob,
  failGroupIssueJob,
} from "./queries/group-issue-jobs"
import { listProjectIssues } from "./queries/issues"
import { tables } from "./schema"

const pgliteTestTimeout = 15_000
const drizzleDir = fileURLToPath(new URL("../drizzle/", import.meta.url))
const stripBreakpoints = (sql: string) => sql.replace(/-->\s*statement-breakpoint\s*/g, "")

async function readMigration(fileName: string) {
  return readFile(resolve(drizzleDir, fileName), "utf8")
}

async function applyMigrations(client: PGlite, fileNames: string[]) {
  for (const fileName of fileNames) {
    await client.exec(stripBreakpoints(await readMigration(fileName)))
  }
}

async function createTestDatabase() {
  const client = new PGlite()

  for (const fileName of (await readdir(drizzleDir)).filter((file) => file.endsWith(".sql")).sort()) {
    await client.exec(stripBreakpoints(await readMigration(fileName)))
  }

  const db = drizzle(client, { schema: tables }) as any

  return { db, client }
}

async function withTestDatabase<T>(run: (db: any) => Promise<T>) {
  const harness = await createTestDatabase()

  try {
    return await run(harness.db)
  } finally {
    await harness.client.close()
  }
}

async function seedProjectApp(db: any, identity: { projectId: string; appId: string }) {
  await db.insert(tables.projects).values({
    id: identity.projectId,
    slug: `project-${identity.projectId}`,
    name: "Project",
  })

  await db.insert(tables.apps).values({
    id: identity.appId,
    projectId: identity.projectId,
    slug: `app-${identity.appId}`,
    name: "App",
  })
}

describe("database schema", () => {
  it("backfills last_event_id when adding the column to populated issues", async () => {
    const client = new PGlite()

    try {
      await applyMigrations(client, ["0000_flat_kylun.sql"])
      await client.exec(`
        insert into projects (id, slug, name, created_at)
        values ('00000000-0000-0000-0000-000000000001', 'project-1', 'Project', now());
        insert into apps (id, project_id, slug, name, created_at)
        values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'app-1', 'App', now());
        insert into issues (
          id,
          project_id,
          app_id,
          fingerprint,
          status,
          first_seen_at,
          last_seen_at,
          occurrences
        )
        values (
          '00000000-0000-0000-0000-000000000003',
          '00000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002',
          'fingerprint-1',
          'open',
          now(),
          now(),
          1
        );
      `)

      await applyMigrations(client, ["0001_complete_war_machine.sql"])

      const { rows } = await client.query("select last_event_id from issues order by id")
      expect(rows[0]?.last_event_id).toBe("")
    } finally {
      await client.close()
    }
  }, pgliteTestTimeout)

  it("deduplicates event inserts at the database boundary", async () => {
    await withTestDatabase(async (db) => {
      const identity = {
        projectId: randomUUID(),
        appId: randomUUID(),
      }

      await seedProjectApp(db, identity)

      const event = {
        id: randomUUID(),
        projectId: identity.projectId,
        appId: identity.appId,
        eventId: "event-1",
        batchId: "batch-1",
        type: "error",
        sessionId: "session-1",
        release: "1.0.0",
        route: "/home",
        payload: { message: "boom" },
        tags: { level: "error" },
        context: { browser: "chrome" },
        occurredAt: new Date("2026-04-15T00:00:00.000Z"),
      }

      const firstInsert = await insertEventWithDedupe(db, event)
      const duplicateInsert = await insertEventWithDedupe(db, {
        ...event,
        id: randomUUID(),
      })

      expect(firstInsert.accepted).toBe(true)
      expect(firstInsert.status).toBe("accepted")
      expect(duplicateInsert.accepted).toBe(false)
      expect(duplicateInsert.status).toBe("duplicate")
      await expect(
        countProjectEventsSince(db, identity, new Date("2026-04-14T00:00:00.000Z")),
      ).resolves.toBe(1)
    })
  }, pgliteTestTimeout)

  it("does not hide non-dedupe insert conflicts as duplicate events", async () => {
    await withTestDatabase(async (db) => {
      const identity = {
        projectId: randomUUID(),
        appId: randomUUID(),
      }

      await seedProjectApp(db, identity)

      const rowId = randomUUID()
      const event = {
        id: rowId,
        projectId: identity.projectId,
        appId: identity.appId,
        eventId: "event-1",
        batchId: "batch-1",
        type: "error",
        sessionId: "session-1",
        release: "1.0.0",
        route: "/home",
        payload: { message: "boom" },
        tags: { level: "error" },
        context: { browser: "chrome" },
        occurredAt: new Date("2026-04-15T00:00:00.000Z"),
      }

      await insertEventWithDedupe(db, event)

      await expect(
        insertEventWithDedupe(db, {
          ...event,
          eventId: "event-2",
        }),
      ).rejects.toThrow()
    })
  }, pgliteTestTimeout)

  it("looks up write keys by hash", async () => {
    await withTestDatabase(async (db) => {
      const identity = {
        projectId: randomUUID(),
        appId: randomUUID(),
      }

      await seedProjectApp(db, identity)
      await db.insert(tables.projectApiKeys).values({
        id: randomUUID(),
        projectId: identity.projectId,
        appId: identity.appId,
        keyHash: "hash_1",
        status: "active",
        allowedOrigins: ["https://example.com"],
        hourlyQuota: 100,
        dailyQuota: 1_000,
      })

      await expect(findWriteKeyByHash(db, "hash_1")).resolves.toMatchObject({
        projectId: identity.projectId,
        appId: identity.appId,
        keyHash: "hash_1",
      })
      await expect(findWriteKeyByHash(db, "missing")).resolves.toBeUndefined()
    })
  }, pgliteTestTimeout)

  it("rejects stale worker updates after a newer claim", async () => {
    await withTestDatabase(async (db) => {
      const now = new Date("2026-04-16T00:00:00.000Z")
      const retryAt = new Date("2026-04-16T01:00:00.000Z")
      const staleCompleteAt = new Date("2026-04-16T02:00:00.000Z")
      const staleFailAt = new Date("2026-04-16T02:30:00.000Z")
      const finalCompleteAt = new Date("2026-04-16T03:00:00.000Z")

      await enqueueGroupIssueJob(db, "event-1")

      const firstClaim = await claimNextGroupIssueJob(db, now)
      expect(firstClaim?.eventId).toBe("event-1")
      expect(firstClaim?.status).toBe("claimed")
      expect(firstClaim?.attempts).toBe(1)
      expect(firstClaim?.claimToken).toBeDefined()

      await failGroupIssueJob(db, {
        jobId: firstClaim!.id,
        claimToken: firstClaim!.claimToken,
        availableAt: retryAt,
        lastError: "retry later",
      })

      const secondClaim = await claimNextGroupIssueJob(db, retryAt)
      expect(secondClaim?.eventId).toBe("event-1")
      expect(secondClaim?.status).toBe("claimed")
      expect(secondClaim?.attempts).toBe(2)
      expect(secondClaim?.claimToken).toBeDefined()
      expect(secondClaim?.claimToken).not.toBe(firstClaim?.claimToken)

      await expect(
        failGroupIssueJob(db, {
          jobId: firstClaim!.id,
          claimToken: firstClaim!.claimToken,
          availableAt: staleFailAt,
          lastError: "stale retry",
        }),
      ).resolves.toBeNull()

      await expect(
        completeGroupIssueJob(db, {
          jobId: firstClaim!.id,
          claimToken: firstClaim!.claimToken,
          completedAt: staleCompleteAt,
        }),
      ).resolves.toBeNull()

      const staleJob = await db.query.groupIssueJobs.findFirst({
        where: (table, { eq }) => eq(table.eventId, "event-1"),
      })

      expect(staleJob).toMatchObject({
        eventId: "event-1",
        status: "claimed",
        attempts: 2,
        lastError: null,
      })
      expect(staleJob?.claimToken).toBe(secondClaim?.claimToken)

      await expect(
        completeGroupIssueJob(db, {
          jobId: secondClaim!.id,
          claimToken: secondClaim!.claimToken,
          completedAt: finalCompleteAt,
        }),
      ).resolves.toMatchObject({
        status: "completed",
        completedAt: finalCompleteAt,
      })
    })
  }, pgliteTestTimeout)

  it("keeps issue reads available for dashboard use", async () => {
    await withTestDatabase(async (db) => {
      const identity = {
        projectId: randomUUID(),
        appId: randomUUID(),
      }

      await seedProjectApp(db, identity)
      await db.insert(tables.issues).values({
        id: randomUUID(),
        projectId: identity.projectId,
        appId: identity.appId,
        fingerprint: "fingerprint-1",
        status: "open",
        firstSeenAt: new Date("2026-04-15T00:00:00.000Z"),
        lastSeenAt: new Date("2026-04-15T00:01:00.000Z"),
        occurrences: 1,
        lastEventId: "event-1",
      })

      await expect(listProjectIssues(db, identity.projectId)).resolves.toHaveLength(1)
    })
  }, pgliteTestTimeout)
})
