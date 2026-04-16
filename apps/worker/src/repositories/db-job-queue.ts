import {
  claimNextGroupIssueJob,
  completeGroupIssueJob,
  failGroupIssueJob,
  type DatabaseClient,
} from "@web-monitoring/db"

import type {
  ClaimedGroupIssueJob,
  GroupIssueJobQueue,
} from "../jobs/process-group-issue-job"

export function createDatabaseJobQueue(
  db: DatabaseClient,
  options: { retryDelayMs?: number } = {},
): GroupIssueJobQueue {
  const retryDelayMs = options.retryDelayMs ?? 60_000

  return {
    async claimNext() {
      const row = await claimNextGroupIssueJob(db, new Date())

      if (!row?.claimToken) return null

      return {
        id: row.id,
        eventId: row.eventId,
        claimToken: row.claimToken,
      }
    },
    async complete(job: ClaimedGroupIssueJob) {
      await completeGroupIssueJob(db, {
        jobId: job.id,
        claimToken: job.claimToken,
        completedAt: new Date(),
      })
    },
    async fail(job: ClaimedGroupIssueJob, error: string) {
      await failGroupIssueJob(db, {
        jobId: job.id,
        claimToken: job.claimToken,
        availableAt: new Date(Date.now() + retryDelayMs),
        lastError: error,
      })
    },
  }
}
