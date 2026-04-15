/** 标准化错误事件的最小载荷。 */
export type RuntimeErrorEvent = {
  message: string
  stack?: string
}

/** 从 Error 对象提取可上报的错误载荷。 */
export function createRuntimeErrorEvent(error: Error): RuntimeErrorEvent {
  return {
    message: error.message,
    stack: error.stack,
  }
}
