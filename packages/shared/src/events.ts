import { z } from "zod"

import { EVENT_TYPES, INGEST_LIMITS } from "./rules"

/** 支持的遥测事件类型 schema。 */
export const eventTypeSchema = z.enum(EVENT_TYPES)

/** SDK 上报的单条事件 envelope schema。 */
export const eventEnvelopeSchema = z.object({
  id: z.string().min(1),
  batchId: z.string().min(1),
  type: eventTypeSchema,
  name: z.string().min(1).optional(),
  schemaVersion: z.number().int().positive(),
  timestamp: z.number().int().positive(),
  projectId: z.string().min(1),
  appId: z.string().min(1),
  sessionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  release: z.string().min(1).optional(),
  env: z.string().min(1).optional(),
  sampling: z
    .object({
      sampleRate: z.number().min(0).max(1),
      sampled: z.boolean(),
      reason: z.string().optional(),
    })
    .optional(),
  trace: z
    .object({
      traceId: z.string().optional(),
      spanId: z.string().optional(),
      requestId: z.string().optional(),
    })
    .optional(),
  url: z.string().url(),
  route: z.string().optional(),
  tags: z.record(z.string(), z.string()),
  context: z.record(z.string(), z.unknown()),
  payload: z.record(z.string(), z.unknown()),
})

/** ingest 批量上报请求 schema。 */
export const batchIngestRequestSchema = z.object({
  batchId: z.string().min(1),
  sentAt: z.number().int().positive(),
  events: z.array(eventEnvelopeSchema).min(1).max(INGEST_LIMITS.maxEventsPerBatch),
})

/** ingest 批量上报响应 schema。 */
export const batchIngestResponseSchema = z.object({
  batchId: z.string().min(1),
  accepted: z.array(z.string()),
  duplicated: z.array(z.string()),
  rejected: z.array(
    z.object({
      eventId: z.string().min(1),
      reason: z.string().min(1),
      retryable: z.boolean(),
    }),
  ),
})

/** 单条事件 envelope 类型。 */
export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>

/** 批量上报请求体类型。 */
export type BatchIngestRequest = z.infer<typeof batchIngestRequestSchema>

/** 批量上报响应体类型。 */
export type BatchIngestResponse = z.infer<typeof batchIngestResponseSchema>
