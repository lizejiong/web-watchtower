import Fastify from "fastify"

import { createDatabaseClient } from "@web-monitoring/db"

import { createDatabaseIngestRepository } from "./repositories/db-ingest-repository"
import { createDatabaseJobPublisher } from "./repositories/db-job-publisher"
import { createDatabaseKeyService } from "./repositories/db-key-service"
import { registerHealthRoute } from "./routes/health"
import { registerIngestRoutes, type IngestRouteDependencies } from "./routes/ingest"
import { createDatabaseRateLimitService } from "./services/rate-limit-service"

/** Builds database-backed dependencies for the runtime server. */
export function createDatabaseIngestRouteDependencies(
  databaseUrl: string,
): IngestRouteDependencies {
  const db = createDatabaseClient(databaseUrl)

  return {
    ingestRepository: createDatabaseIngestRepository(db),
    jobPublisher: createDatabaseJobPublisher(db),
    keyService: createDatabaseKeyService(db),
    rateLimitService: createDatabaseRateLimitService(db),
  }
}

/** Builds an injectable Fastify app for tests and runtime. */
export function buildApp(dependencies: IngestRouteDependencies = {}) {
  const app = Fastify({
    logger: true,
  })

  registerHealthRoute(app)
  registerIngestRoutes(app, dependencies)

  return app
}
