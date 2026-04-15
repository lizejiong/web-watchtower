import type { FastifyInstance } from "fastify"

import { batchIngestRequestSchema } from "@web-monitoring/shared/events"
import { INGEST_BATCH_PATH } from "@web-monitoring/shared/protocol"

import { readWriteKey } from "../plugins/auth"
import { ingestBatch, type IngestRepository } from "../services/ingest-service"
import {
  checkIngestRateLimit,
  type RateLimitService,
} from "../services/rate-limit-service"
import { validateWriteKey, type KeyService } from "../services/key-service"

const defaultRepository: IngestRepository = {
  async insertEvent() {
    return { status: "accepted" }
  },
}

const defaultKeyService: KeyService = {
  validateWriteKey,
}

const defaultRateLimitService: RateLimitService = {
  checkIngestRateLimit,
}

/** ingest 路由依赖。 */
export type IngestRouteDependencies = {
  ingestRepository?: IngestRepository
  keyService?: KeyService
  rateLimitService?: RateLimitService
}

/** 注册批量 ingest 路由。 */
export function registerIngestRoutes(
  app: FastifyInstance,
  dependencies: IngestRouteDependencies = {},
) {
  const repository = dependencies.ingestRepository ?? defaultRepository
  const keyService = dependencies.keyService ?? defaultKeyService
  const rateLimitService = dependencies.rateLimitService ?? defaultRateLimitService

  app.post(INGEST_BATCH_PATH, async (request, reply) => {
    const writeKey = readWriteKey(request)

    if (!writeKey) {
      return reply.code(401).send({ error: "missing_write_key" })
    }

    const keyContext = await keyService.validateWriteKey(writeKey)

    if (!keyContext) {
      return reply.code(401).send({ error: "invalid_write_key" })
    }

    const rateLimit = await rateLimitService.checkIngestRateLimit(keyContext)

    if (!rateLimit.allowed) {
      return reply.code(429).send({ error: rateLimit.reason ?? "rate_limited" })
    }

    const parsed = batchIngestRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_batch" })
    }

    const response = await ingestBatch(repository, parsed.data)

    return reply.code(202).send(response)
  })
}
