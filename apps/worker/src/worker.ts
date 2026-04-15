import { createDatabaseClient } from "@web-monitoring/db"

import {
  processNextGroupIssueJob,
  type GroupIssueEventReader,
  type GroupIssueJobQueue,
} from "./jobs/process-group-issue-job"
import type { IssueGroupingRepository } from "./jobs/group-issue"
import { createDatabaseEventReader } from "./repositories/db-event-reader"
import { createDatabaseIssueRepository } from "./repositories/db-issue-repository"
import { createDatabaseJobQueue } from "./repositories/db-job-queue"

export function createWorkerRuntime(dependencies: {
  queue: GroupIssueJobQueue
  eventReader: GroupIssueEventReader
  issueRepository: IssueGroupingRepository
}) {
  return {
    drainOnce() {
      return processNextGroupIssueJob(
        dependencies.queue,
        dependencies.eventReader,
        dependencies.issueRepository,
      )
    },
  }
}

export function createDatabaseWorkerRuntime(databaseUrl: string) {
  const db = createDatabaseClient(databaseUrl)

  return createWorkerRuntime({
    queue: createDatabaseJobQueue(db),
    eventReader: createDatabaseEventReader(db),
    issueRepository: createDatabaseIssueRepository(db),
  })
}
