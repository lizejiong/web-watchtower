import { drizzle } from "drizzle-orm/pglite"
import { randomUUID } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PGlite } from "@electric-sql/pglite"
import { describe, expect, it } from "vitest"

import { countProjectEventsSince, insertEventWithDedupe } from "./queries/events"
import {
  claimNextGroupIssueJob,
  completeGroupIssueJob,
  enqueueGroupIssueJob,
  failGroupIssueJob,
} from "./queries/group-issue-jobs"
import { listProjectIssues } from "./queries/issues"
import { tables } from "./schema"

const drizzleDir = fileURLToPath(new URL("../drizzle/", import.meta.url))

async function createTestDatabase() {
  const client = new PGlite()

  for (const fileName of (await readdir(drizzleDir)).filter((file) => file.endsWith(".sql")).sort()) {
    const migration = await readFile(resolve(drizzleDir, fileName), "utf8")
    await client.exec(migration.replace(/-->\s*statement-breakpoint\s*/g, ""))
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
      const duplicateInsert = await insertEventWithDedupe(db, event)

      expect(firstInsert.accepted).toBe(true)
      expect(firstInsert.status).toBe("accepted")
      expect(duplicateInsert.accepted).toBe(false)
      expect(duplicateInsert.status).toBe("duplicate")
      await expect(
        countProjectEventsSince(db, identity, new Date("2026-04-14T00:00:00.000Z")),
      ).resolves.toBe(1)
    })
  })

  it("claims pending jobs, reschedules failures, and completes work", async () => {
    await withTestDatabase(async (db) => {
      const now = new Date("2026-04-16T00:00:00.000Z")
      const retryAt = new Date("2026-04-16T01:00:00.000Z")

      await enqueueGroupIssueJob(db, "event-1")
      await enqueueGroupIssueJob(db, "event-2")

      const firstClaim = await claimNextGroupIssueJob(db, now)
      expect(firstClaim?.eventId).toBe("event-1")
      expect(firstClaim?.status).toBe("claimed")
      expect(firstClaim?.attempts).toBe(1)

      await failGroupIssueJob(db, firstClaim!.id, {
        availableAt: retryAt,
        lastError: "retry later",
      })

      const secondClaim = await claimNextGroupIssueJob(db, now)
      expect(secondClaim?.eventId).toBe("event-2")
      expect(secondClaim?.status).toBe("claimed")
      expect(secondClaim?.attempts).toBe(1)

      await completeGroupIssueJob(db, secondClaim!.id, now)

      const firstJob = await db.query.groupIssueJobs.findFirst({
        where: (table, { eq }) => eq(table.eventId, "event-1"),
      })
      const secondJob = await db.query.groupIssueJobs.findFirst({
        where: (table, { eq }) => eq(table.eventId, "event-2"),
      })

      expect(firstJob).toMatchObject({
        eventId: "event-1",
        status: "pending",
        attempts: 1,
        lastError: "retry later",
      })
      expect(firstJob?.claimedAt).toBeNull()
      expect(firstJob?.availableAt?.toISOString()).toBe(retryAt.toISOString())

      expect(secondJob).toMatchObject({
        eventId: "event-2",
        status: "completed",
        attempts: 1,
      })
      expect(secondJob?.completedAt?.toISOString()).toBe(now.toISOString())
    })
  })

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
  })
})
