import type { FastifyInstance } from "fastify"

/** 注册健康检查路由。 */
export function registerHealthRoute(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }))
}
