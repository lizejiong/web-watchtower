import { buildApp } from "./app"
import { getConfig } from "./config"

const app = buildApp()
const config = getConfig()

await app.listen({
  host: config.host,
  port: config.port,
})
