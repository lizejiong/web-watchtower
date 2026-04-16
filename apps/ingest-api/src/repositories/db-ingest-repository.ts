import { insertEventWithDedupe, type DatabaseClient } from "@web-monitoring/db"

import type { IngestRepository } from "../services/ingest-service"

export function createDatabaseIngestRepository(db: DatabaseClient): IngestRepository {
  return {
    async insertEvent(event) {
      const result = await insertEventWithDedupe(db, {
        projectId: event.projectId,
        appId: event.appId,
        eventId: event.id,
        batchId: event.batchId,
        type: event.type,
        sessionId: event.sessionId,
        release: event.release ?? null,
        route: event.route ?? null,
        payload: event.payload,
        tags: event.tags,
        context: event.context,
        occurredAt: new Date(event.timestamp),
      })

      return {
        status: result.status === "accepted" ? "accepted" : "duplicated",
      }
    },
  }
}
