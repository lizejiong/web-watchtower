import { randomUUID } from "node:crypto"

import { and, asc, eq, lte } from "drizzle-orm"

import type { DatabaseClient } from "../client"
import { groupIssueJobs } from "../schema"

export async function enqueueGroupIssueJob(db: DatabaseClient, eventId: string) {
  await db
    .insert(groupIssueJobs)
    .values({ id: randomUUID(), eventId })
    .onConflictDoNothing()
}

export async function claimNextGroupIssueJob(db: DatabaseClient, now: Date) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(groupIssueJobs)
      .where(
        and(eq(groupIssueJobs.status, "pending"), lte(groupIssueJobs.availableAt, now)),
      )
      .orderBy(asc(groupIssueJobs.availableAt), asc(groupIssueJobs.id))
      .for("update", { skipLocked: true })
      .limit(1)

    if (!job) {
      return null
    }

    const rows = await tx
      .update(groupIssueJobs)
      .set({
        status: "claimed",
        attempts: job.attempts + 1,
        claimedAt: now,
        completedAt: null,
        lastError: null,
      })
      .where(eq(groupIssueJobs.id, job.id))
      .returning()

    return rows[0] ?? null
  })
}

export async function completeGroupIssueJob(
  db: DatabaseClient,
  jobId: string,
  completedAt: Date,
) {
  const rows = await db
    .update(groupIssueJobs)
    .set({
      status: "completed",
      completedAt,
      lastError: null,
    })
    .where(eq(groupIssueJobs.id, jobId))
    .returning()

  return rows[0] ?? null
}

export async function rescheduleGroupIssueJob(
  db: DatabaseClient,
  jobId: string,
  availableAt: Date,
  lastError?: string,
) {
  const rows = await db
    .update(groupIssueJobs)
    .set({
      status: "pending",
      availableAt,
      claimedAt: null,
      completedAt: null,
      lastError: lastError ?? null,
    })
    .where(eq(groupIssueJobs.id, jobId))
    .returning()

  return rows[0] ?? null
}

export async function failGroupIssueJob(
  db: DatabaseClient,
  jobId: string,
  input: { availableAt: Date; lastError: string },
) {
  return rescheduleGroupIssueJob(db, jobId, input.availableAt, input.lastError)
}
