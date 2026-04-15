import { eq } from "drizzle-orm"

import { events, type DatabaseClient } from "@web-monitoring/db"

import type { GroupIssueEventReader } from "../jobs/process-group-issue-job"

export function createDatabaseEventReader(db: DatabaseClient): GroupIssueEventReader {
  return {
    async findByEventId(eventId) {
      const row = await db.query.events.findFirst({
        where: eq(events.eventId, eventId),
      })

      if (!row) return null

      return {
        id: row.eventId,
        projectId: row.projectId,
        appId: row.appId,
        type: row.type,
        route: row.route ?? undefined,
        release: row.release ?? undefined,
        occurredAt: row.occurredAt,
        payload: row.payload as { message?: string; stack?: string },
      }
    },
  }
}
