import { buildApp, createDatabaseIngestRouteDependencies } from "./app"
import { getConfig } from "./config"

const config = getConfig()

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required to run the ingest API")
}

const app = buildApp(createDatabaseIngestRouteDependencies(config.databaseUrl))

await app.listen({
  host: config.host,
  port: config.port,
})
