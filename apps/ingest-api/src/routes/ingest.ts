import type { FastifyInstance } from "fastify"

import { batchIngestRequestSchema } from "@web-monitoring/shared/events"
import { INGEST_BATCH_PATH } from "@web-monitoring/shared/protocol"

import { readWriteKey } from "../plugins/auth"

/** 注册批量 ingest 路由。 */
export async function registerIngestRoutes(app: FastifyInstance) {
  app.post(INGEST_BATCH_PATH, async (request, reply) => {
    const writeKey = readWriteKey(request)

    if (!writeKey) {
      return reply.code(401).send({ error: "missing_write_key" })
    }

    const parsed = batchIngestRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_batch" })
    }

    return reply.code(202).send({
      batchId: parsed.data.batchId,
      accepted: [],
      duplicated: [],
      rejected: [],
    })
  })
}
