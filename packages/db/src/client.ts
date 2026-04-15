import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { tables } from "./schema"

/** 创建数据库客户端并挂载 Phase 1 schema。 */
export function createDatabaseClient(databaseUrl: string) {
  const queryClient = postgres(databaseUrl, {
    prepare: false,
  })

  return drizzle(queryClient, {
    schema: tables,
  })
}

/** 数据库客户端类型。 */
export type DatabaseClient = ReturnType<typeof createDatabaseClient>
