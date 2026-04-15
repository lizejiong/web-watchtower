import type { FastifyRequest } from "fastify"

import { WRITE_KEY_HEADER } from "@web-monitoring/shared/protocol"

/** 从请求头中读取写入 key。 */
export function readWriteKey(request: FastifyRequest) {
  const writeKey = request.headers[WRITE_KEY_HEADER]

  if (typeof writeKey !== "string" || writeKey.length === 0) {
    return null
  }

  return writeKey
}
