import Fastify from "fastify"

import { registerHealthRoute } from "./routes/health"
import { registerIngestRoutes, type IngestRouteDependencies } from "./routes/ingest"

/** 构建可注入测试的 Fastify 应用。 */
export function buildApp(dependencies: IngestRouteDependencies = {}) {
  const app = Fastify({
    logger: true,
  })

  registerHealthRoute(app)
  registerIngestRoutes(app, dependencies)

  return app
}
