/** 将动态路由段归一化为稳定模式。 */
export function normalizeRoute(route?: string) {
  return route?.replace(/\/\d+/g, "/:id") ?? "/unknown"
}

/** 将错误消息中的动态数字归一化，避免误拆 Issue。 */
export function normalizeMessage(message?: string) {
  return (message ?? "unknown_error").replace(/\b\d{3,}\b/g, ":num")
}

/** 构建错误事件的归并指纹。 */
export function buildErrorFingerprint(event: {
  route?: string
  release?: string
  payload: { message?: string; stack?: string }
}) {
  const firstFrame = event.payload.stack?.split("\n")[1]?.trim() ?? "no_frame"

  return [
    normalizeRoute(event.route),
    normalizeMessage(event.payload.message),
    firstFrame,
    event.release ?? "no_release",
  ].join("::")
}
