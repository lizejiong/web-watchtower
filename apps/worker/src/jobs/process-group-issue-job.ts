import { groupIssue, type GroupableEvent, type IssueGroupingRepository } from "./group-issue"

export type ClaimedGroupIssueJob = {
  id: string
  eventId: string
  claimToken: string
}

export type GroupIssueJobQueue = {
  claimNext: () => Promise<ClaimedGroupIssueJob | null>
  complete: (job: ClaimedGroupIssueJob) => Promise<void>
  fail: (job: ClaimedGroupIssueJob, error: string) => Promise<void>
}

export type GroupIssueEventReader = {
  findByEventId: (eventId: string) => Promise<GroupableEvent | null>
}

export async function processNextGroupIssueJob(
  queue: GroupIssueJobQueue,
  eventReader: GroupIssueEventReader,
  repository: IssueGroupingRepository,
) {
  const job = await queue.claimNext()
  if (!job) return false

  try {
    const event = await eventReader.findByEventId(job.eventId)

    if (!event) {
      await queue.fail(job, "event_not_found")
      return false
    }

    await groupIssue(repository, event)
    await queue.complete(job)
    return true
  } catch (error) {
    await queue.fail(job, error instanceof Error ? error.message : "unknown_error")
    return false
  }
}
