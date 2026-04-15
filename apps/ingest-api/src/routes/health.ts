import type { FastifyInstance } from "fastify"

/** 注册健康检查路由。 */
export async function registerHealthRoute(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }))
}
