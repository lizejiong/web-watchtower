/** 写入 key 解析后的项目上下文。 */
export type WriteKeyContext = {
  projectId: string
  appId: string
  hourlyQuota: number
  dailyQuota: number
  allowedOrigins: string[]
}

export type WriteKeyRecord = WriteKeyContext & {
  status: string
  expiresAt: Date | null
}

/** 写入 key 服务接口。 */
export type KeyService = {
  validateWriteKey: (
    writeKey: string,
    origin?: string,
  ) => Promise<WriteKeyContext | null>
}

export function validateWriteKeyRecord(
  record: WriteKeyRecord | null | undefined,
  origin?: string,
  now = new Date(),
): WriteKeyContext | null {
  if (!record || record.status !== "active") {
    return null
  }

  if (record.expiresAt && record.expiresAt.getTime() <= now.getTime()) {
    return null
  }

  if (record.allowedOrigins.length > 0 && (!origin || !record.allowedOrigins.includes(origin))) {
    return null
  }

  return {
    projectId: record.projectId,
    appId: record.appId,
    hourlyQuota: record.hourlyQuota,
    dailyQuota: record.dailyQuota,
    allowedOrigins: record.allowedOrigins,
  }
}

/** Phase 1 的最小写入 key 校验。 */
export async function validateWriteKey(
  writeKey: string,
): Promise<WriteKeyContext | null> {
  if (writeKey.length === 0) {
    return null
  }

  return {
    projectId: "proj_1",
    appId: "app_1",
    hourlyQuota: Number.MAX_SAFE_INTEGER,
    dailyQuota: Number.MAX_SAFE_INTEGER,
    allowedOrigins: [],
  }
}
