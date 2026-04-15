import { enqueueGroupIssueJob, type DatabaseClient } from "@web-monitoring/db"

import type { JobPublisher } from "../services/job-publisher"

export function createDatabaseJobPublisher(db: DatabaseClient): JobPublisher {
  return {
    async publish(job) {
      await enqueueGroupIssueJob(db, job.payload.eventId)
    },
  }
}
