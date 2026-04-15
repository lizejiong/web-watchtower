/** group_issue 任务定义。 */
export type GroupIssueJob = {
  type: "group_issue"
  payload: {
    eventId: string
  }
}

/** 任务发布器接口。 */
export type JobPublisher = {
  publish: (job: GroupIssueJob) => Promise<void>
}

/** 发布错误事件的 Issue 归并任务。 */
export async function publishGroupIssueJob(
  publisher: JobPublisher,
  eventId: string,
) {
  await publisher.publish({
    type: "group_issue",
    payload: { eventId },
  })
}
