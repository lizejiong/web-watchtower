/** Worker 任务类型。 */
export type WorkerJob<TPayload = unknown> = {
  type: string
  payload: TPayload
}

/** 最小内存队列实现，供 Phase 1 先串起接口边界。 */
export function createInMemoryQueue() {
  const jobs: WorkerJob[] = []

  return {
    publish(job: WorkerJob) {
      jobs.push(job)
    },
    takeAll() {
      return [...jobs]
    },
  }
}
