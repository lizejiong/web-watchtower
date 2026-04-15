import { buildErrorFingerprint } from "../lib/fingerprint"

/** Issue 归并仓储接口。 */
export type IssueGroupingRepository = {
  findIssueByFingerprint: (
    fingerprint: string,
  ) => Promise<{ id: string; occurrences: number } | null>
  insertIssue: (fingerprint: string, eventId: string) => Promise<void>
  incrementIssue: (issueId: string, eventId: string) => Promise<void>
}

/** 执行单条错误事件的 Issue 归并。 */
export async function groupIssue(
  repository: IssueGroupingRepository,
  event: {
    id: string
    type: string
    route?: string
    release?: string
    payload: { message?: string; stack?: string }
  },
) {
  const fingerprint = buildErrorFingerprint(event)
  const issue = await repository.findIssueByFingerprint(fingerprint)

  if (!issue) {
    await repository.insertIssue(fingerprint, event.id)
    return
  }

  await repository.incrementIssue(issue.id, event.id)
}
