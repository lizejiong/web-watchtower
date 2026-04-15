/** 写入 key 解析后的项目上下文。 */
export type WriteKeyContext = {
  projectId: string
  appId: string
}

/** 写入 key 服务接口。 */
export type KeyService = {
  validateWriteKey: (writeKey: string) => Promise<WriteKeyContext | null>
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
  }
}
