import Fastify from "fastify"

import { registerHealthRoute } from "./routes/health"
import { registerIngestRoutes } from "./routes/ingest"

/** 构建可注入测试的 Fastify 应用。 */
export function buildApp() {
  const app = Fastify({
    logger: true,
  })

  app.register(registerHealthRoute)
  app.register(registerIngestRoutes)

  return app
}
