# Web 监控平台设计

**日期：** 2026-04-14

**状态：** 待评审草案

## 1. 目标

构建一个 Web 监控平台，第一版具备以下能力：

- 一个可接入 Web 应用的浏览器 SDK
- 自动采集请求、错误、性能和用户行为事件
- 基于 `IndexedDB` 的离线缓冲与延迟批量上报
- 一个负责接收、存储、归并和查询事件的后端
- 一个支持动作触发的规则引擎与告警系统
- 面向归并后问题的 AI 根因分析
- 针对适合修复的问题自动创建 GitHub Pull Request
- 使用 `Sentry` 作为第一版源码映射层，基于 Source Map 精准定位源码位置

第一版面向“单组织下的多个 `project/app`”，不面向多租户 SaaS 隔离、计费，也不试图在第一版做成通用可观测性平台。

## 2. 产品范围

### 第一版包含

- 一个平台管理多个项目/应用
- 自动埋点浏览器 SDK
- 事件批量上报与离线重传
- 错误归并为 Issue
- 基础规则引擎和告警通知
- 面向错误类 Issue 的 AI 分析
- 自动创建 GitHub PR
- 借助 Sentry 完成 Source Map 上传和堆栈映射

### 第一版不包含

- Session Replay
- 多租户 RBAC 与计费
- GitLab 或 Bitbucket 支持
- 自动 merge PR
- 复杂事件流处理基础设施
- 全文日志平台能力
- AI 自动执行大规模重构

## 3. 总体架构

系统分为三层：

1. **客户端采集层**
   - 将 `sdk-web` 接入浏览器应用
   - 负责采集并标准化遥测数据
   - 在本地缓冲数据并按批次上报

2. **后端控制面**
   - 接收事件
   - 存储标准化后的数据
   - 提供项目、Issue、规则、告警、分析结果等 API

3. **异步执行层**
   - 归并 Issue
   - 执行规则
   - 发送告警
   - 执行 AI 分析
   - 自动创建 GitHub PR

### 运行单元

- `apps/dashboard`
  - 管理后台，负责项目、规则、Issue、告警、AI 分析结果和 PR 记录展示
- `apps/ingest-api`
  - 接收浏览器 SDK 的批量遥测数据
- `apps/worker`
  - 消费队列中的任务并执行后台工作流
- `packages/sdk-web`
  - 浏览器 SDK
- `packages/shared`
  - 共享类型、Schema、常量与工具函数
- `packages/db`
  - 数据库 Schema 与查询封装
- `packages/ai`
  - AI 适配层与底层 provider 实现
- `packages/github`
  - GitHub App 集成

## 4. 推荐技术栈

### Monorepo 与工程基础

- `pnpm workspace`
- `Turborepo`
- `TypeScript`
- `Node.js 24 Active LTS`

### 前端

- `Next.js App Router` 用于 `dashboard`
- `Tailwind CSS`
- `Radix UI primitives`
- `TanStack Query`
- `React Hook Form`
- `Zod`

### 后端

- `Fastify` 作为 HTTP API 框架
- `pino` 作为日志方案
- `Drizzle ORM`，并在事件、队列、聚合等重 SQL 场景下配合原生 SQL

### 数据与基础设施

- `Supabase Postgres`
- `Supabase Storage`
- `Supabase Queues (pgmq)`

### 监控与 Source Map

- `@sentry/browser`
- Sentry 的 release 与 Source Map 上传流程

### AI 与 GitHub

- `Vercel AI SDK`，但必须封装在平台自有的 adapter 接口后面
- `GitHub App`
- `Octokit`

### 测试

- `Vitest`
- `Playwright`

## 5. 浏览器 SDK 设计

### 职责

SDK 对外暴露统一初始化入口，并在初始化后启用自动埋点，同时保留少量手动扩展点。

配置形态示例：

```ts
monitoring.init({
  appId,
  projectId,
  release,
  env,
  transport: {
    endpoint,
    writeKey,
    batchSize: 50,
    flushIntervalMs: 5000,
    maxQueueSize: 5000,
    sampleRate: 1.0,
    sampleRatesByType: {
      error: 1.0,
      request: 1.0,
      performance: 1.0,
      behavior: 1.0,
      breadcrumb: 1.0,
    },
  },
  offline: {
    enabled: true,
  },
  privacy: {
    maskInputs: true,
    redactHeaders: ["authorization", "cookie"],
  },
  sentry: {
    enabled: true,
    dsn,
  },
})
```

### SDK 写入鉴权模型

SDK 使用的是**公开写入 key**，不是 secret。

要求：

- 每个 `project/app` 分配独立 `writeKey`
- `writeKey` 仅允许写入 ingest 事件，不允许读配置或读数据
- `writeKey` 必须支持轮换、禁用、过期时间、来源限制
- 来源限制至少支持：
  - 允许的 `Origin`
  - 可选的包名或站点白名单
- 平台必须记录 key 级别用量，用于配额与滥用检测

### 写入 Key 安全边界

- `writeKey` 视为可暴露凭据，不可授予管理权限
- 单 key 必须支持速率限制、日配额、突发上限
- 支持发现异常流量后快速禁用单 key，不影响同项目其他 app
- 允许后台触发 key 轮换，并给出双 key 过渡窗口

### 内部模块

- `core`
  - 配置管理
  - 生命周期管理
  - 插件注册
- `collectors/error`
  - `window.onerror`
  - `unhandledrejection`
  - 通过 integration 接入框架错误边界
- `collectors/network`
  - `fetch`
  - `XMLHttpRequest`
- `collectors/performance`
  - Web Vitals
  - Long Task
- `collectors/behavior`
  - 页面访问
  - 路由变化
  - 点击
  - 输入
- `collectors/breadcrumbs`
  - 维护轻量上下文轨迹
- `processors`
  - 标准化
  - 数据补充
  - 去重
  - 隐私过滤
- `queue`
  - 内存队列
  - `IndexedDB` 持久化
- `transport`
  - 批量上报
  - 采样
  - 重试
  - 退避
  - 在线状态感知
- `integrations/sentry`
  - 与 Sentry 的错误、release 元数据桥接
- `integrations/react`
  - React Error Boundary
  - React Router / Next Router 路由感知
- `integrations/vue`
  - `app.config.errorHandler`
  - `vue-router` 路由感知

### 自动采集内容

SDK 自动采集：

- 运行时 JavaScript 错误
- 未处理的 Promise rejection
- `fetch` 与 `XMLHttpRequest` 请求摘要
- 页面访问
- 路由变化
- 点击事件
- 输入事件
- 与错误关联的 breadcrumb 轨迹

### 隐私约束

第一版采用保守默认值：

- 默认不采集 request body
- 默认不采集 response body
- 输入值默认脱敏
- 敏感请求头默认打码
- 点击与输入仅记录轻量 DOM 定位信息

### 采样策略

第一版支持全局采样和按事件类型采样：

- `sampleRate`
  - 全局采样率，默认 `1.0`
- `sampleRatesByType`
  - 按事件类型覆盖采样率

规则：

- 错误事件默认推荐全量采集
- 请求、性能、行为事件在高流量项目中可以单独下调采样率
- 一旦某条事件被保留，该事件关联的必要上下文字段必须一起保留
- 采样决策必须在 SDK 本地完成，并随事件携带采样元数据

### 离线与批量上报

第一版离线能力的可靠基础是 `IndexedDB`，而不是单独依赖 Service Worker。

- 在线路径
  - 事件先进入内存队列
  - 队列按数量阈值和时间阈值 flush
- 失败路径
  - 发送失败的事件写入 `IndexedDB`
- 恢复路径
  - 网络恢复后回放已持久化批次
- 增强路径
  - 后续可加入 Service Worker 做后台辅助，但它不是正确性的前提

### 事件投递语义

SDK 到 ingest 的投递语义定义如下：

- 每个批次必须带 `batchId`
- 每条事件必须带稳定的 `eventId`
- SDK 至少提供 **at-least-once** 投递保证，不承诺 exactly-once
- 离线重放、超时重试、页面刷新后补发都允许重复发送同一 `eventId`
- 服务端必须基于 `eventId` 做去重，保证重复事件不重复计数

### 批量响应语义

ingest 对批量请求必须支持部分成功响应：

```ts
type BatchIngestResponse = {
  batchId: string
  accepted: string[]
  duplicated: string[]
  rejected: Array<{
    eventId: string
    reason: string
    retryable: boolean
  }>
}
```

规则：

- `accepted`
  - 服务端已接收并进入后续处理
- `duplicated`
  - 服务端识别为重复事件，SDK 视为成功
- `rejected.retryable = true`
  - SDK 应保留并稍后重试
- `rejected.retryable = false`
  - SDK 应丢弃并记录 dropped counter

### 队列上限与丢弃策略

当浏览器端本地队列达到上限时，采用优先级淘汰，而不是无限增长：

- 优先保留 `error` 事件
- 其次保留 `request` 事件
- 再其次保留 `performance` 事件
- 最先淘汰最旧的 `breadcrumb` 与 `behavior` 事件
- 达到硬上限后仍无法写入时，记录本地 dropped counter，并上报丢弃统计

## 6. 事件模型

所有 SDK 事件统一包裹为 envelope：

```ts
type EventEnvelope = {
  id: string
  type: "error" | "performance" | "request" | "behavior" | "breadcrumb" | "custom"
  name?: string
  schemaVersion: number
  timestamp: number
  projectId: string
  appId: string
  sessionId: string
  userId?: string
  release?: string
  env?: string
  batchId: string
  sampling?: {
    sampleRate: number
    sampled: boolean
    reason?: string
  }
  trace?: {
    traceId?: string
    spanId?: string
    requestId?: string
  }
  url: string
  route?: string
  tags: Record<string, string>
  context: Record<string, unknown>
  payload: Record<string, unknown>
}
```

### 可扩展性约束

第一版保留严格的顶层 `type` 枚举，避免服务端校验失控，不直接开放 `type: string`。

扩展方式为：

- 使用 `type: "custom"`
- 配合 `name` 字段承载命名空间事件名，例如 `checkout.payment_retry`
- 通过 `schemaVersion` 管理演进

### 幂等与去重字段

- `id`
  - 事件唯一标识，对应 SDK 侧生成的 `eventId`
- `batchId`
  - 批次唯一标识
- 服务端去重主键以 `projectId + appId + id` 为基础
- 默认去重窗口建议至少覆盖原始事件保留期，避免离线重放引发重复计数

### 各类事件的主要载荷

- `error`
  - message
  - stack
  - filename
  - line/column
  - handled/unhandled
  - 归并所需的标准化 fingerprint 种子
- `request`
  - method
  - URL
  - status
  - duration
  - request id 或 trace id（如果可用）
- `performance`
  - metric name
  - value
  - rating
  - navigation 元数据
- `behavior`
  - 事件类型
  - target selector
  - 脱敏后的元数据
- `breadcrumb`
  - category
  - level
  - summary
  - 关联事件引用
- `custom`
  - namespaced event name
  - 自定义 payload

## 7. 后端设计

### `ingest-api`

职责：

- 认证项目/app key
- 校验事件批次
- 标准化并做轻量数据补充
- 执行限流
- 持久化原始事件和必要索引
- 投递后续处理任务
- 注入全链路 `traceId`

不负责：

- 高成本聚合
- 规则执行
- AI 分析
- GitHub 交互

### ingest 鉴权与配额控制

ingest 只接受公开写入 key，不接受后台管理凭据。

要求：

- 按 `project/app/writeKey` 做认证
- 支持 key 状态：`active`、`rotating`、`disabled`、`expired`
- 支持来源限制校验，如 `Origin`、站点白名单
- 支持按 key、app、project 三层速率限制
- 支持按天或按小时配额统计
- 支持异常模式识别，如单 key 突增、异常来源、异常错误率

### ingest 去重与部分成功处理

- ingest 必须是幂等接口
- 对同一个 `projectId + appId + eventId` 重复写入时，只保留一份原始事件并返回 `duplicated`
- 批量内部分成功时，不允许整个 batch 因个别坏事件失败
- 仅对不可解析、鉴权失败、超过硬限制等事件返回 `rejected`
- worker 重试不应重新插入原始事件，而应重试后续 job

### `dashboard`

职责：

- 项目/app 配置
- 规则管理
- 告警目标管理
- Issue 与事件查询
- AI 分析结果展示
- PR 记录展示

### `worker`

`worker` 是一个常驻后台进程，用来消费队列任务。它不是某一个 job，而是负责执行多种 job 类型的服务。

第一版需要支持的 job 包括：

- `group_issue`
- `evaluate_rules`
- `send_alert`
- `run_ai_analysis`
- `create_github_pr`

第一版建议先实现成一个服务，内部按 job type 分 handler。后续如果流量或隔离需求上升，再拆成多个 worker。

## 8. Dashboard 认证与授权

第一版后台用户认证建议使用 `Supabase Auth + GitHub OAuth`：

- 使用 GitHub 账号登录后台
- 使用 Supabase Auth 维护 session
- 平台数据库维护组织、项目、角色映射

### 第一版角色

- `org_admin`
  - 管理组织、项目、代码仓库、GitHub App 安装、全局规则与告警渠道
- `project_admin`
  - 管理指定项目的 app、规则、告警渠道、仓库绑定
- `developer`
  - 查看事件、Issue、分析结果、PR 记录，可手动触发有限动作
- `viewer`
  - 只读访问指定项目

### 访问控制要求

- 所有 Dashboard 查询必须带项目作用域
- 用户只可访问被授权项目
- GitHub 仓库绑定和自动 PR 配置仅 `org_admin` 与 `project_admin` 可修改
- 审计日志至少记录登录、权限变更、规则变更、仓库绑定、AI 手动触发、PR 自动创建

## 9. Supabase 的适用边界

如果把 Supabase 定位为“数据与轻服务底座”，而不是整套 AI 执行时，那么它是适合第一版的。

### 适合用 Supabase 做的事情

- 用 Postgres 存关系数据
- 用对象存储保存 Source Map 和附件
- 用 `pgmq` 做任务队列
- 用 Edge Functions 做轻量 webhook 或管理型端点
- 用 Supabase Auth 维护 Dashboard 用户 session

### 不适合用 Supabase Edge Functions 做的事情

- 长时间运行的 AI 分析
- 多轮补丁生成循环
- 带校验和重试的多步骤 PR 创建工作流

这些任务应该放在外部 `worker` 中执行。

## 10. 规则引擎设计

### 核心对象

- `event`
- `issue`
- `rule`
- `alert`
- `action`

### 归并策略

第一版 Issue 归并策略有意保持简单且确定性强。

#### 错误类 Issue

fingerprint 基础字段：

- 标准化错误类型
- 标准化错误消息
- 关键堆栈前几帧
- 路由模式
- release

#### 请求类 Issue

fingerprint 基础字段：

- method
- 标准化 URL 模式
- status class 或错误码

#### 性能类 Issue

fingerprint 基础字段：

- metric name
- 路由模式
- release

### 第一版规则类型

- 错误频次阈值
- 受影响 session 数阈值
- 请求失败率阈值
- 性能退化阈值

### 规则统计口径

第一版必须明确各项统计的分子、分母和采样兼容方式。

#### 错误频次阈值

- 分子：时间窗口内命中同一 Issue fingerprint 的 `error occurrence` 数
- 分母：无分母，为绝对数量阈值
- 采样兼容：仅在错误事件全量采集时可直接使用；若错误事件采样，则必须在界面和规则配置中显式标记该指标为估算值

#### 受影响 Session 数阈值

- 分子：时间窗口内命中同一 Issue 且 `sessionId` 去重后的数量
- 分母：无分母，为绝对受影响 session 数
- 采样兼容：仅在错误事件不采样，且 session 粒度保留完整时认为可信；否则标记为下界估计值

#### 请求失败率阈值

- 分子：时间窗口内满足失败条件的请求数，如 `5xx` 或配置的错误码集合
- 分母：同时间窗口、同路由模式、同 method 范围内的总请求数
- 采样兼容：若请求事件启用了统一随机采样，且成功与失败请求使用同一采样率，可直接估算失败率；若分层采样不一致，则不允许启用严格失败率规则

#### 性能退化阈值

- 分子：时间窗口内满足阈值条件的性能样本数，或聚合百分位值
- 分母：同时间窗口内的性能样本总数
- 采样兼容：若性能采样率稳定，则允许计算百分位近似值；若采样率动态波动，则标记指标置信度下降

### 规则模型

```ts
type Rule = {
  id: string
  projectId: string
  enabled: boolean
  eventType: "error" | "request" | "performance"
  filters: {
    env?: string[]
    release?: string[]
    route?: string[]
    tags?: Record<string, string[]>
    severity?: string[]
  }
  aggregation: {
    window: "5m" | "15m" | "1h"
    threshold: number
    uniqueBy?: "issue" | "user" | "session"
  }
  actions: Array<
    | { type: "notify"; channelIds: string[] }
    | { type: "run_ai_analysis" }
    | { type: "create_github_pr"; requireAiAnalysis: true }
  >
}
```

### 复合条件扩展策略

第一版不直接引入通用 DSL 或布尔表达式树，避免规则系统复杂度过早膨胀。

未来如需扩展，可在不破坏第一版数据模型的前提下增加：

```ts
type AdvancedRuleFilter = {
  and?: AdvancedRuleFilter[]
  or?: AdvancedRuleFilter[]
  not?: AdvancedRuleFilter
  predicate?: {
    field: string
    op: "eq" | "neq" | "gte" | "lte" | "in" | "contains"
    value: unknown
  }
}
```

### 降噪要求

第一版告警必须包含：

- dedupe
- cooldown window
- environment 作用域
- severity
- 恢复后再次恶化时的 reopen 行为

## 11. AI 分析与修复设计

### AI Adapter 层

平台在 `packages/ai` 中维护自有 AI 抽象层。

它暴露的是平台内部稳定的操作语义，例如：

- 分析 Issue
- 生成补丁
- 生成 PR 摘要

`worker` 只依赖这层接口，不直接依赖某个模型 provider。第一版底层通过 `Vercel AI SDK` 实现。

接口示例：

```ts
interface AiService {
  analyzeIssue(input: AnalyzeIssueInput): Promise<AnalyzeIssueResult>
  generatePatch(input: GeneratePatchInput): Promise<GeneratePatchResult>
  summarizePullRequest(
    input: SummarizePullRequestInput
  ): Promise<SummarizePullRequestResult>
}
```

### AI 分析输入

AI 分析接收结构化 issue bundle，包括：

- issue 元数据
- 聚合后的出现统计
- 标准化堆栈
- Source Map 还原后的源码位置
- 最近 breadcrumb
- 关联请求摘要
- release 与 commit 元数据
- 相关代码片段和最近 diff

第一版默认不会把整个仓库全部喂给模型。

### 根因分析输出

```ts
type AnalyzeIssueResult = {
  rootCause: string
  confidence: number
  suspectedFiles: string[]
  failingPath: string[]
  proposedFixSummary: string
  testStrategy: string
  riskNotes: string[]
}
```

### 自动修复范围

第一版自动修复仅限于小范围、低风险问题，例如：

- 缺失 null 判断
- 缺失存在性判断
- Promise 流程未兜底
- 响应字段兼容性判断缺失
- 小范围 fallback 逻辑修复

第一版明确不自动修复：

- 大规模重构
- schema 迁移
- 安全敏感改动
- 性能系统性优化
- 需要产品判断的业务逻辑调整

### AI 超时与重试

- 单次 AI 根因分析超时上限：`5m`
- 单次 patch 生成超时上限：`5m`
- 每类 AI job 最多重试 `2` 次，采用指数退避
- 超时或结构化输出校验失败后，job 标记为 `failed`，仅保留分析失败记录，不自动创建 PR

## 12. GitHub PR 工作流

第一版仅支持 GitHub。

### 认证方式

- GitHub App 认证
- installation 级别访问

### 流程

1. AI 分析通过置信度阈值
2. worker 解析代码仓库与 commit 上下文
3. worker 从目标 commit 创建修复分支
4. worker 在隔离执行环境中应用 AI 生成的 patch
5. worker 运行受限验证命令
6. 若验证通过，worker 提交并推送分支
7. worker 创建 PR

### 自动 PR 执行隔离

自动 PR 执行必须在隔离 runner 中完成，而不是在共享服务进程或共享工作目录中直接执行。

最小要求：

- 每个 PR job 使用独立工作目录
- 推荐使用一次性容器或短生命周期 runner
- 执行完成后销毁工作目录与临时凭据
- GitHub token 使用 installation-scoped 最小权限 token
- 默认禁止对外任意网络访问，仅允许：
  - GitHub API
  - 必要的依赖源镜像（如项目明确允许）
  - 平台内部必要服务
- 限制 CPU、内存、磁盘、执行时长
- 不允许共享上一个 job 的文件系统状态

### 必要护栏

- repository allowlist
- 只允许写修复分支，禁止直接写默认分支
- patch 大小限制
- 验证命令 allowlist
- forbidden pattern 黑名单
- 置信度阈值
- cooldown 防止反复刷 PR
- 仅自动创建 PR，不自动 merge

### 验证命令约束

第一版验证命令必须来自项目级 allowlist，例如：

```ts
const allowedCommands = [
  "pnpm lint",
  "pnpm typecheck",
  "pnpm test",
  "pnpm --filter web build",
]

const forbiddenPatterns = [
  /npm publish/,
  /pnpm publish/,
  /git push/,
  /rm\s+-rf/,
  /del\s+\/s/,
]
```

规则：

- AI 不得自由拼接 shell 命令
- 只允许从预配置命令集中选择执行
- 禁止网络发布、删除性命令、Git 推送类命令作为验证命令

### GitHub API 限流处理

- 遇到 `Retry-After` 或 rate limit 响应时按返回值退避
- 仅暂停对应 repository 的 PR 任务 lane，不阻塞全局队列
- 若退避超过阈值，保留任务并标记 `deferred`

### PR 内容

每个 PR 至少包含：

- 问题摘要
- 根因分析
- 修复摘要
- 验证结果
- 已知风险
- 平台内 Issue 记录链接

## 13. Source Map 策略

第一版浏览器错误的源码映射由 `Sentry` 负责。

### Release 纪律

每次前端发布必须产出：

- 唯一 `release`
- 对应的 Source Map 上传
- `release`、`commit sha`、`repo` 与应用元数据之间的映射关系

### 平台侧要求

- SDK 事件必须携带 `release`
- 后端必须存储 release 到 commit 的映射
- worker 在组装 AI 上下文时必须使用还原后的源码位置

### 缺失 Source Map 时的降级行为

- 将 `symbolication_status` 标记为 `missing`
- 允许保留 minified stack 进行基础聚合
- 默认不自动创建修复 PR
- 允许触发告警和人工查看

### 为什么第一版使用 Sentry

Sentry 已经成熟解决了浏览器堆栈符号化以及 release/source map 处理。第一版没有必要过早自建一套源码定位基础设施。

## 14. 数据保留与生命周期管理

### 默认保留策略

- 原始事件明细：默认保留 `14` 天
- 聚合后的 issue occurrence 与指标汇总：默认保留 `90` 天
- Issue 元数据：默认保留 `180` 天
- 审计日志与 PR 记录：默认保留 `180` 天
- Source Map 与 release artifact：至少保留到对应 release 下线后 `90` 天

### Issue 归档策略

- 已解决且连续 `30` 天无新 occurrence 的 Issue 自动归档
- 被归档 Issue 再次出现时自动 reopen

### 冷数据归档

- 超过原始事件保留周期的原始 batch，可按项目配置归档到对象存储
- 冷归档默认不参与在线查询
- 需要追溯时再异步恢复或做离线分析

## 15. 数据库模型

### 主要表

- `projects`
- `apps`
- `project_api_keys`
- `org_members`
- `project_members`
- `audit_logs`
- `events`
- `issues`
- `issue_occurrences`
- `rules`
- `alert_channels`
- `alerts`
- `alert_actions`
- `ai_analyses`
- `repositories`
- `release_artifacts`
- `pull_requests`
- `job_runs`

### 对象存储用途

对象存储用于保存：

- 上传后的 Source Map
- 大对象附件
- 冷归档原始 payload 快照

### 队列用途

使用 `pgmq` 承载以下队列：

- issue 归并
- 规则执行
- 告警分发
- AI 分析
- GitHub PR 执行

## 16. 性能目标与 SLI

第一版不是高吞吐日志平台，但需要给出最小可接受性能目标。

### 建议 SLI

- 批量事件接收接口延迟
  - 在单批次 `<= 500` 条事件且请求体 `<= 512KB` 的前提下，`P99 < 200ms`
- 事件接收吞吐
  - 单实例目标 `>= 1000 events/s`
- Issue 归并延迟
  - 从事件入库到 Issue 更新完成，目标 `<= 60s`
- 规则执行延迟
  - 从 Issue 更新到规则动作触发，目标 `<= 120s`
- AI 根因分析超时
  - 单次分析硬超时 `5m`
- 自动 PR 全链路完成时间
  - 从 AI 任务启动到 PR 创建完成，目标 `<= 15m`

### 说明

这些是第一版的工程目标，不是对外 SLA。实际数值需要在 playground 与压测环境中校准。

## 17. 平台自身监控

平台必须监控自身，而不是只监控用户业务项目。

### 必须观测的内部指标

- ingest API 请求量、失败率、延迟
- worker 存活状态与心跳
- 各队列深度与最老任务年龄
- AI 调用成功率、失败率、超时率、平均耗时
- GitHub PR 创建成功率与限流次数
- dropped events 计数
- Source Map 缺失率

### Trace 与关联要求

- ingest API 为每个批次生成或接入 `traceId`
- `traceId` 必须在事件入库、job 创建、worker 执行、AI 调用、GitHub PR 创建之间串联
- Dashboard 应可按 `traceId` 查询关键链路

### 健康检查

- `ingest-api` 提供 liveness 与 readiness 检查
- `worker` 提供 heartbeat 与 queue lag 指标
- 队列积压超过阈值时必须触发内部告警

## 18. 边界条件与故障处理

### 队列积压或队列满

- 浏览器本地队列满时执行优先级淘汰
- 服务端 AI 队列积压时优先降级 AI job，不影响 ingest 与基础告警链路
- 服务端 job backlog 超阈值时，暂停非关键任务投递并触发内部告警

### AI 分析超时

- 最多重试 `2` 次
- 连续失败后降级为“仅保留分析失败记录 + 普通告警”
- 不得因为 AI 失败阻塞 issue 归并或普通告警链路

### GitHub API 限流

- 按 repo 维度退避
- 保留待执行任务
- 超过最大退避时间后标记为 `deferred`

### Worker 宕机

- job 必须具备可重试和幂等语义
- worker 消费队列时必须使用 lease 或 visibility timeout 机制
- worker 异常退出后，未完成任务必须可重新投递或重新领取

### Source Map 缺失

- 标记缺失状态
- 允许 issue 归并与普通告警
- 默认禁止自动创建 PR

### 离线重放后的重复事件

- 同一 `eventId` 的重复上报视为幂等重放，不得重复创建 occurrence
- 已写入的事件再次到达时返回 `duplicated`
- 若同一 batch 中存在 accepted 与 duplicated 混合结果，SDK 只重试 `retryable` 的 rejected 子集

### 部分成功批次重试

- SDK 必须基于响应结果只重试失败且 `retryable=true` 的事件子集
- 不允许把整个原批次无脑重发，避免放大重复流量
- 若客户端因超时未拿到响应，可整体重试同一 `batchId`，服务端依赖 `eventId` 去重

## 19. 推荐仓库结构

```text
apps/
  dashboard/
  ingest-api/
  worker/
  playground-react/
packages/
  ai/
  db/
  github/
  sdk-web/
  shared/
docs/
  superpowers/
    specs/
```

### Playground 要求

第一版应在同一个 monorepo 中包含一个专用 `playground` 应用，它是 SDK 与整条后端链路的标准验证目标。

这个 playground 需要提供明确的触发入口，用来制造：

- 运行时错误
- Promise rejection
- 请求失败
- 路由切换
- 点击和输入 breadcrumb
- 离线缓存与恢复重放

## 20. 测试策略

### 单元测试

使用 `Vitest` 测试：

- SDK processors
- 队列行为
- fingerprint 生成
- 隐私过滤
- AI adapter 输出校验
- 规则匹配逻辑
- GitHub 命令 allowlist 校验
- 批量部分成功与重试选择逻辑

### 集成测试

通过 API 级测试验证：

- 批量接收
- ingest 幂等去重
- Issue 归并
- 规则执行
- 队列任务创建
- 角色与项目权限校验

### 端到端测试

使用 `Playwright` 配合 monorepo 中的 `playground` 应用验证：

- 浏览器事件采集
- 离线持久化与恢复重放
- 从接收到 Issue 创建的链路
- 规则触发后的告警流
- 登录后台后的项目级数据隔离
- 部分成功批次后的精准重试

### Release 与 Source Map 验证

不要把热更新开发构建当作 Source Map 验证方式。

Source Map 的验证流程必须是：

1. 构建 production artifact
2. 分配 release id
3. 将 Source Map 上传到 Sentry
4. 主动触发一个已知浏览器错误
5. 验证堆栈是否正确还原到源码位置

## 21. 术语表

- `Event`：单条遥测事件
- `Issue`：归并后的问题单元
- `Occurrence`：某个 Issue 的一次出现记录
- `Rule`：匹配条件与动作定义
- `Alert`：某次规则命中的执行结果
- `Breadcrumb`：错误前后的轻量上下文轨迹
- `Release`：一次可追踪的前端发布版本标识
- `Worker`：消费后台 job 的常驻进程
- `Job`：进入队列等待执行的一条后台任务
- `AI Adapter`：平台内部稳定的 AI 调用接口层
- `Write Key`：暴露给前端 SDK 的公开写入凭据，仅可写入事件

## 22. 分阶段交付

### Phase 1

- monorepo 初始化
- SDK core
- SDK 写入鉴权与批量协议
- ingestion API
- 事件持久化
- release 元数据存储
- ingest 幂等去重
- Issue 归并
- Dashboard 基础认证与项目权限骨架
- playground 应用

### Phase 2

- 规则引擎
- 规则统计口径与采样兼容
- 告警渠道
- Issue 与告警后台页面
- 内部监控与队列健康告警

### Phase 3

- Sentry Source Map 集成
- AI 根因分析
- AI adapter 与 provider 接入

### Phase 4

- GitHub App 集成
- 隔离 runner
- patch 生成
- 验证流水线
- 自动创建 PR

## 23. 设计决策摘要

- 面向单组织下多个 `project/app` 构建一个平台
- 使用一个代码仓库，但运行时拆分为 API 与 worker，而不是直接做成大量微服务
- 以 `IndexedDB` 作为离线缓冲的可靠基础
- 以 `Supabase` 作为数据库、对象存储、认证和队列基础设施
- 第一版使用公开写入 key 做 SDK 写入鉴权，但严格限制权限、来源、配额和速率
- ingest 采用 at-least-once + 服务端去重的投递模型
- 第一版使用 `Sentry` 解决浏览器 Source Map 与堆栈符号化问题
- 在平台内部使用自有 AI adapter，对外底层接 `Vercel AI SDK`
- 自动 PR 必须在隔离执行环境中完成
- 第一版仅支持 GitHub
- 第一版自动创建 PR，但不自动 merge

## 24. 风险与缓解

### 风险：告警噪音过高

缓解方式：

- 确定性归并
- cooldown
- dedupe
- 基于阈值触发 AI
- 可配置采样
- 明确统计口径

### 风险：AI 打开低质量 PR

缓解方式：

- 置信度阈值
- patch 大小限制
- 限定可自动修复的问题类型
- 受控验证命令
- 隔离 runner
- 通过 PR 保持人工 review

### 风险：Source Map 映射错位

缓解方式：

- 严格 release 纪律
- 强制保存 release 元数据
- 只用 production build 做映射验证

### 风险：隐私泄露

缓解方式：

- 输入脱敏
- 请求头打码
- 默认不采集 body
- 项目级隐私配置

### 风险：后台异步任务拖垮核心链路

缓解方式：

- ingest 与 worker 解耦
- AI 队列独立退避
- 内部队列积压告警
- 非关键任务优先降级

### 风险：公开写入 key 被滥用

缓解方式：

- 来源限制
- key 级配额与速率限制
- 异常模式检测
- 快速禁用与轮换

## 25. 审批关口

在这份 spec 评审通过后，下一份产物应是实现计划，保存路径为：

- `docs/superpowers/plans/YYYY-MM-DD-web-monitoring-platform.md`

实现计划需要把工作拆成小步、可测试的任务，并保持本设计中定义的阶段边界。
