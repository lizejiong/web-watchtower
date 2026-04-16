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
    const claimToken = randomUUID()
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
        claimToken,
        claimedAt: now,
        completedAt: null,
        lastError: null,
      })
      .where(eq(groupIssueJobs.id, job.id))
      .returning()

    return rows[0] ?? null
  })
}

export type ClaimedGroupIssueJob = {
  jobId: string
  claimToken: string
}

export type CompleteGroupIssueJobInput = ClaimedGroupIssueJob & {
  completedAt: Date
}

export type RescheduleGroupIssueJobInput = ClaimedGroupIssueJob & {
  availableAt: Date
  lastError?: string
}

export async function completeGroupIssueJob(db: DatabaseClient, input: CompleteGroupIssueJobInput) {
  const rows = await db
    .update(groupIssueJobs)
    .set({
      status: "completed",
      claimToken: null,
      claimedAt: null,
      completedAt: input.completedAt,
      lastError: null,
    })
    .where(
      and(
        eq(groupIssueJobs.id, input.jobId),
        eq(groupIssueJobs.claimToken, input.claimToken),
        eq(groupIssueJobs.status, "claimed"),
      ),
    )
    .returning()

  return rows[0] ?? null
}

export async function rescheduleGroupIssueJob(db: DatabaseClient, input: RescheduleGroupIssueJobInput) {
  const rows = await db
    .update(groupIssueJobs)
    .set({
      status: "pending",
      claimToken: null,
      claimedAt: null,
      availableAt: input.availableAt,
      completedAt: null,
      lastError: input.lastError ?? null,
    })
    .where(
      and(
        eq(groupIssueJobs.id, input.jobId),
        eq(groupIssueJobs.claimToken, input.claimToken),
        eq(groupIssueJobs.status, "claimed"),
      ),
    )
    .returning()

  return rows[0] ?? null
}

export async function failGroupIssueJob(
  db: DatabaseClient,
  input: RescheduleGroupIssueJobInput,
) {
  return rescheduleGroupIssueJob(db, input)
}
