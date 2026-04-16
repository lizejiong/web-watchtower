import { buildErrorFingerprint } from "../lib/fingerprint"

export type GroupableEvent = {
  id: string
  projectId: string
  appId: string
  type: string
  route?: string
  release?: string
  occurredAt: Date
  payload: { message?: string; stack?: string }
}

export type IssueFingerprintLookup = {
  projectId: string
  appId: string
  fingerprint: string
}

export type InsertIssueInput = IssueFingerprintLookup & {
  firstSeenAt: Date
  lastSeenAt: Date
  lastEventId: string
}

export type IssueGroupingRepository = {
  findIssueByFingerprint: (
    input: IssueFingerprintLookup,
  ) => Promise<{ id: string; occurrences: number } | null>
  insertIssue: (input: InsertIssueInput) => Promise<void>
  incrementIssue: (
    issueId: string,
    lastEventId: string,
    lastSeenAt: Date,
  ) => Promise<void>
}

export async function groupIssue(
  repository: IssueGroupingRepository,
  event: GroupableEvent,
) {
  const fingerprint = buildErrorFingerprint(event)
  const issue = await repository.findIssueByFingerprint({
    projectId: event.projectId,
    appId: event.appId,
    fingerprint,
  })

  if (!issue) {
    await repository.insertIssue({
      projectId: event.projectId,
      appId: event.appId,
      fingerprint,
      firstSeenAt: event.occurredAt,
      lastSeenAt: event.occurredAt,
      lastEventId: event.id,
    })
    return
  }

  await repository.incrementIssue(issue.id, event.id, event.occurredAt)
}
