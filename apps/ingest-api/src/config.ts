/** ingest-api 的基础运行配置。 */
export type IngestApiConfig = {
  host: string
  port: number
}

/** 读取 ingest-api 的运行配置。 */
export function getConfig(): IngestApiConfig {
  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? "3001"),
  }
}
