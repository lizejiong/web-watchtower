import { and, eq, sql } from "drizzle-orm"

import { issues, type DatabaseClient } from "@web-monitoring/db"

import type { IssueGroupingRepository } from "../jobs/group-issue"

export function createDatabaseIssueRepository(
  db: DatabaseClient,
): IssueGroupingRepository {
  return {
    async findIssueByFingerprint(input) {
      const row = await db.query.issues.findFirst({
        where: and(
          eq(issues.projectId, input.projectId),
          eq(issues.appId, input.appId),
          eq(issues.fingerprint, input.fingerprint),
        ),
      })

      return row ?? null
    },
    async insertIssue(input) {
      await db.insert(issues).values({
        projectId: input.projectId,
        appId: input.appId,
        fingerprint: input.fingerprint,
        firstSeenAt: input.firstSeenAt,
        lastSeenAt: input.lastSeenAt,
        lastEventId: input.lastEventId,
        occurrences: 1,
      })
    },
    async incrementIssue(issueId, lastEventId, lastSeenAt) {
      await db
        .update(issues)
        .set({
          lastEventId,
          lastSeenAt,
          occurrences: sql`${issues.occurrences} + 1`,
        })
        .where(eq(issues.id, issueId))
    },
  }
}
