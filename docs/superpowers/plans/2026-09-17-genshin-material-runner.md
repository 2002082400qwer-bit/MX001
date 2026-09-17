# 原神跑图采集材料工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可在 Windows PC 离线运行的 Tauri 桌面工具，完成“选择材料—创建路线—跑图记录—刷新提示—本地备份”的最小闭环。

**Architecture:** React 表现层只能调用 TypeScript 应用与领域服务；内容、路线、会话和刷新规则互相隔离并可独立测试。Tauri 2 仅作为桌面宿主和最小安全配置，不暴露自定义 Rust 命令；个人数据通过 Dexie/IndexedDB 保存，备份通过 Web `File` 与 Blob 下载实现。

**Tech Stack:** Tauri 2、React、TypeScript 严格模式、Vite、Leaflet、React-Leaflet、Zustand、Dexie、Zod、Luxon、Vitest、React Testing Library、Playwright、npm。

**Spec:** `docs/superpowers/specs/2026-09-17-genshin-material-runner-design.md`

## Global Constraints

- 仅支持 Windows PC；不实现移动端、账号、云同步、社区投稿或在线更新服务。
- 不读取或控制游戏，不读取内存、画面、Cookie，也不抓取或镜像第三方地图数据。
- 仓库只包含自行制作的网格示意图和演示内容；不得加入未经授权的游戏地图、图标、点位或路线数据。
- 所有 TypeScript 与 Rust 函数实现必须使用中文注释说明函数职责和参数作用。
- 表现层不得直接访问 Dexie、解析 JSON 或承载路线/刷新规则。
- 领域坐标只使用 `{ x, y }`；唯一的 Leaflet 坐标转换为 `[height - y, x]`。
- 首版内容包随应用发布，不提供图形化内容包导入；个人备份只接受严格 Schema、UTF-8 JSON、最大 5 MiB，并只做合并导入。
- Tauri 不添加文件系统、Shell、HTTP、全局快捷键或其它权限插件；保持默认最小 capability 和严格 CSP。
- 使用 npm 与 `package-lock.json`；Rust 使用 stable MSVC 工具链，不使用 GNU 工具链。

---

## Planned File Structure

```text
src/
  app/App.tsx                         # 顶层编排与页面状态切换
  app/App.module.css                  # 应用布局样式
  components/
    MaterialCatalog.tsx               # 材料选择与区域筛选
    RouteSummary.tsx                  # 路线摘要与创建入口
    RunMode.tsx                       # 当前路线步骤和完成操作
    RouteMap.tsx                      # Leaflet 图层、标记与折线
    BackupPanel.tsx                   # 备份导入导出界面
    ErrorNotice.tsx                   # 可访问的错误提示
  content/
    demo-content.json                 # 自制演示内容
    route-grid.svg                    # 自制网格示意地图
  domain/
    types.ts                          # 领域类型与联合类型
    schemas.ts                        # Zod 内容和备份 Schema
    contentRepository.ts              # 内置内容读取与校验
    routePlanner.ts                   # 模板筛选、拼接和路线快照
    refreshCalculator.ts              # 三种刷新规则计算
    runSessionService.ts              # 会话状态机与幂等记录生成
    mapCoordinates.ts                 # 领域坐标到 Leaflet 坐标转换
  infrastructure/
    database.ts                       # Dexie 表结构和事务入口
    userDataRepository.ts             # 用户数据读写与合并导入
    backupService.ts                  # Blob 导出、File 导入与 5 MiB 检查
  state/appStore.ts                   # 仅保存界面瞬态状态
  test/setup.ts                       # Vitest、DOM 与 fake IndexedDB 初始化
  main.tsx
  styles/tokens.css
  styles/global.css
  domain/*.test.ts
  infrastructure/*.test.ts
  components/*.test.tsx
e2e/run-session.spec.ts               # 主用户流程
e2e/backup.spec.ts                    # 备份失败和冲突流程
src-tauri/
  src/lib.rs                           # 无自定义命令的 Tauri 启动函数
  tauri.conf.json                      # 窗口、构建和 CSP 配置
  capabilities/default.json            # 最小默认 capability
package.json
vite.config.ts
vitest.config.ts
playwright.config.ts
```

### Task 1: 初始化版本库、前置依赖与可测试的 Tauri/React 骨架

**Files:**
- Create: `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `src/main.tsx`, `src/app/App.tsx`, `src/test/setup.ts`, `src-tauri/**`
- Modify: `.gitignore`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: Node v24、npm、Windows、设计说明中的最小权限约束。
- Produces: 可运行的 `npm run dev`、`npm run test`、`npm run build` 与 `npm run tauri dev` 命令，以及后续任务依赖的 React 测试环境。

- [ ] **Step 1: 安装并验证 Tauri Windows 前置依赖**

在管理员 PowerShell 中仅通过可审计包管理器安装 Rust stable MSVC、Visual Studio Build Tools 的 C++ 桌面工作负载，以及 WebView2 Evergreen Runtime；安装后新开终端执行：

```powershell
rustc -V
cargo -V
rustup show active-toolchain
where.exe cl
```

Expected: Rust 工具链名称包含 `x86_64-pc-windows-msvc`，并且 `cl.exe` 可被找到。若 WebView2 运行时无法被系统检测，先安装 Evergreen Runtime 再继续，不使用 GNU Rust 工具链。

- [ ] **Step 2: 初始化 Git 与基础包清单**

```powershell
git init
git switch -c feature/genshin-material-runner
npm init -y
npm install react react-dom leaflet react-leaflet zustand dexie zod luxon
npm install -D @tauri-apps/cli @types/react @types/react-dom @types/leaflet @vitejs/plugin-react typescript vite vitest jsdom @testing-library/jest-dom @testing-library/react @testing-library/user-event fake-indexeddb playwright
```

Expected: 根目录生成 `package-lock.json`；`npm ls --depth=0` 不报告缺失包；Git 状态只显示新建的项目文件。

- [ ] **Step 3: 写入失败的挂载测试**

```tsx
// src/app/App.test.tsx
import { render, screen } from '@testing-library/react'
import { App } from './App'

it('展示应用标题和演示内容提示', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: '原神跑图助手' })).toBeInTheDocument()
  expect(screen.getByText('演示内容包')).toBeInTheDocument()
})
```

- [ ] **Step 4: 验证测试先失败**

Run: `npm run test -- --run src/app/App.test.tsx`

Expected: FAIL，原因是 `src/app/App.tsx` 或所需测试配置尚不存在。

- [ ] **Step 5: 创建最小 Vite/React 配置和应用实现**

配置 `tsconfig.app.json` 开启 `strict` 与 `resolveJsonModule`；`vite.config.ts` 使用 `@vitejs/plugin-react` 并忽略 `**/src-tauri/**`；配置 Vitest 为 `jsdom` 并加载 `src/test/setup.ts`。`package.json` 至少包含以下脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "tauri": "tauri"
  }
}
```

`App` 先只输出标题和“演示内容包”标签：

```tsx
// src/app/App.tsx
/** 应用根组件，负责承载后续的材料选择、路线和跑图视图。 */
export function App() {
  return (
    <main>
      <h1>原神跑图助手</h1>
      <p>演示内容包</p>
    </main>
  )
}
```

使用 `npx tauri init` 初始化 Tauri，并在提示中填写：应用名 `原神跑图助手`、窗口标题 `原神跑图助手`、前端资源目录 `../dist`、开发 URL `http://localhost:5173`、开发命令 `npm run dev`、构建命令 `npm run build`。将 CSP 配置为仅允许自身资源、`data:` 图片和 Vite 开发服务器；production CSP 不允许远程脚本、远程请求或远程页面访问本地 API。

- [ ] **Step 6: 验证 Web 骨架通过且 Tauri 配置可解析**

Run: `npm run test -- --run src/app/App.test.tsx` then `npm run build`

Expected: 两条命令均 PASS；`dist/` 生成。随后运行 `npm run tauri dev`，Expected: Windows 桌面窗口显示标题和演示内容提示。

- [ ] **Step 7: 提交骨架**

```powershell
git add .
git commit -m "chore: bootstrap tauri react application"
```

### Task 2: 定义可校验的内容、备份与坐标模型

**Files:**
- Create: `src/domain/types.ts`, `src/domain/schemas.ts`, `src/domain/contentRepository.ts`, `src/domain/mapCoordinates.ts`, `src/content/demo-content.json`, `src/content/route-grid.svg`
- Test: `src/domain/schemas.test.ts`, `src/domain/mapCoordinates.test.ts`, `src/domain/contentRepository.test.ts`

**Interfaces:**
- Consumes: Task 1 的 TypeScript、Vitest 配置。
- Produces: `loadBuiltInContent(): Result<ContentPackage, ContentValidationError>`、`toLeafletCoordinate(coordinate, bounds): [number, number]`、`parseBackupEnvelope(input): BackupEnvelope`。

- [ ] **Step 1: 写入失败的内容和坐标测试**

```ts
// src/domain/mapCoordinates.test.ts
import { expect, it } from 'vitest'
import { toLeafletCoordinate } from './mapCoordinates'

it('将左上原点的领域坐标转换为 Leaflet 坐标', () => {
  expect(toLeafletCoordinate({ x: 240, y: 180 }, { width: 1000, height: 600 }))
    .toEqual([420, 240])
})
```

```ts
// src/domain/schemas.test.ts
import { expect, it } from 'vitest'
import { contentPackageSchema } from './schemas'
import validContent from '../content/demo-content.json'

it('拒绝非 HoYoLAB 外链', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://example.com'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/domain/mapCoordinates.test.ts src/domain/schemas.test.ts`

Expected: FAIL，原因是领域模块不存在。

- [ ] **Step 3: 实现领域联合类型和 Zod Schema**

```ts
// src/domain/types.ts
export type MapCoordinate = { x: number; y: number }
export type RespawnRule =
  | { kind: 'duration'; hours: number }
  | { kind: 'dailyReset'; timeZone: string; hour: number; minute: number }
  | { kind: 'manual'; message: string }
export type RefreshEstimate =
  | { kind: 'known'; availableAt: string; isAvailable: boolean }
  | { kind: 'manual'; message: string }
  | { kind: 'unknown' }
export type RouteStep =
  | { id: string; kind: 'teleport'; anchorId: string }
  | { id: string; kind: 'collect'; locationPointId: string }
  | { id: string; kind: 'note'; message: string }
export type ResolvedRouteStep = {
  id: string
  kind: RouteStep['kind']
  title: string
  message?: string
  mapLayerId?: string
  coordinate?: MapCoordinate
  externalMapUrl?: string
  respawnRule?: RespawnRule
  locationPointId?: string
}
export type RoutePlan = {
  id: string
  templateIds: string[]
  estimatedMinutes: number
  steps: ResolvedRouteStep[]
}
export type RoutePlanResult =
  | { kind: 'planned'; plan: RoutePlan }
  | { kind: 'no-route'; reason: 'missing-template' }
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
export type ContentValidationError = { code: 'invalid-built-in-content'; message: string }
```

`schemas.ts` 必须使用 `.strict()`，校验 `externalMapUrl` 的协议为 HTTPS 且主机精确为 `act.hoyolab.com`，校验 `sourceUrl` 为 HTTPS，校验点位在所属 `MapLayer.bounds` 内。演示内容至少包含两个材料、一个 `1000 x 600` 网格图层、两个传送点、六个采集点和两条各含 `teleport`、`collect`、`note` 的路线。

- [ ] **Step 4: 实现内容仓储与坐标转换**

```ts
// src/domain/mapCoordinates.ts
/** 将业务坐标转换为 Leaflet CRS.Simple 使用的 [y, x] 坐标。 */
export function toLeafletCoordinate(
  coordinate: MapCoordinate,
  bounds: { width: number; height: number },
): [number, number] {
  return [bounds.height - coordinate.y, coordinate.x]
}
```

`loadBuiltInContent` 必须解析内置 JSON，并返回显式成功/失败结果，不能在模块导入时抛出未处理异常。

- [ ] **Step 5: 验证领域模型**

Run: `npm run test -- --run src/domain/schemas.test.ts src/domain/mapCoordinates.test.ts src/domain/contentRepository.test.ts`

Expected: PASS；覆盖合法演示内容、越界坐标、错误外链、非 HTTPS 溯源链接和损坏 JSON。

- [ ] **Step 6: 提交内容模型**

```powershell
git add src/domain src/content
git commit -m "feat: add validated local content model"
```

### Task 3: 实现路线规划与刷新时间领域规则

**Files:**
- Create: `src/domain/routePlanner.ts`, `src/domain/refreshCalculator.ts`
- Test: `src/domain/routePlanner.test.ts`, `src/domain/refreshCalculator.test.ts`

**Interfaces:**
- Consumes: `ContentPackage`、`RouteTemplate`、`RespawnRule`、`MapCoordinate`。
- Produces: `planRoute(input): RoutePlanResult`、`getNextAvailableAt(rule, collectedAt, now): RefreshEstimate`。

- [ ] **Step 1: 写入失败的路线和刷新测试**

```ts
// src/domain/routePlanner.test.ts
it('按区域拼接匹配材料的人工路线并保留步骤快照', () => {
  const result = planRoute(content, { materialIds: ['mint', 'mushroom'], regionId: 'demo-region' })
  expect(result.kind).toBe('planned')
  if (result.kind !== 'planned') throw new Error('路线应当存在')
  const { plan } = result
  expect(plan.templateIds).toEqual(['mint-route-1', 'mushroom-route-1'])
  expect(plan.steps.find((step) => step.kind === 'collect')).toMatchObject({ coordinate: { x: 160, y: 120 } })
})
```

```ts
// src/domain/refreshCalculator.test.ts
it('按 UTC 采集时间计算持续型刷新时间', () => {
  expect(getNextAvailableAt({ kind: 'duration', hours: 48 }, '2026-09-17T00:00:00.000Z', new Date('2026-09-18T00:00:00.000Z')))
    .toEqual({ kind: 'known', availableAt: '2026-09-19T00:00:00.000Z' })
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/domain/routePlanner.test.ts src/domain/refreshCalculator.test.ts`

Expected: FAIL，原因是规划器和刷新计算器不存在。

- [ ] **Step 3: 实现最小路线规划器**

`planRoute` 只选择材料集合和区域同时匹配的模板，按内容包中的模板顺序拼接，去除重复路线 ID，计算步骤数与模板 `estimatedMinutes` 总和。它将模板步骤解析为 `ResolvedRouteStep`，把点位/锚点的名称、坐标、图层、说明、外链和刷新规则复制到快照中。没有候选模板时返回 `{ kind: 'no-route', reason: 'missing-template' }`，不能猜测最短路径。

- [ ] **Step 4: 实现三种刷新计算规则**

```ts
// src/domain/refreshCalculator.ts
import { DateTime } from 'luxon'

/** 根据采集时间与规则生成可展示的刷新估算结果。 */
export function getNextAvailableAt(
  rule: RespawnRule,
  collectedAt: string,
  now: Date,
): RefreshEstimate {
  const collected = DateTime.fromISO(collectedAt, { zone: 'utc' })
  if (!collected.isValid) return { kind: 'unknown' }
  if (rule.kind === 'manual') return { kind: 'manual', message: rule.message }
  const next = rule.kind === 'duration'
    ? collected.plus({ hours: rule.hours })
    : nextDailyReset(collected, rule.timeZone, rule.hour, rule.minute)
  if (!next?.isValid) return { kind: 'unknown' }
  const availableAt = next.toUTC().toISO()
  if (!availableAt) return { kind: 'unknown' }
  return {
    kind: 'known',
    availableAt,
    isAvailable: next.toMillis() <= now.getTime(),
  }
}

/** 计算采集时刻之后的下一次指定时区每日重置时间。 */
function nextDailyReset(
  collected: DateTime,
  timeZone: string,
  hour: number,
  minute: number,
): DateTime | undefined {
  const local = collected.setZone(timeZone)
  if (!local.isValid || hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined
  const todayReset = local.startOf('day').set({ hour, minute })
  return todayReset.toMillis() > local.toMillis() ? todayReset : todayReset.plus({ days: 1 })
}
```

`dailyReset` 必须选择采集时刻之后的下一个规则时刻；无效时区、无效时间或未知规则一律返回 `{ kind: 'unknown' }`，不产生猜测日期。

- [ ] **Step 5: 验证领域规则**

Run: `npm run test -- --run src/domain/routePlanner.test.ts src/domain/refreshCalculator.test.ts`

Expected: PASS；覆盖多材料拼接、无模板、三种刷新规则、无效时区和当天重置边界。

- [ ] **Step 6: 提交领域规则**

```powershell
git add src/domain
git commit -m "feat: add route planning and refresh rules"
```

### Task 4: 建立 Dexie 持久化与会话状态机

**Files:**
- Create: `src/infrastructure/database.ts`, `src/infrastructure/userDataRepository.ts`, `src/domain/runSessionService.ts`
- Test: `src/infrastructure/userDataRepository.test.ts`, `src/domain/runSessionService.test.ts`

**Interfaces:**
- Consumes: `RoutePlan`、`ResolvedRouteStep`、Dexie、fake IndexedDB。
- Produces: `createSession(plan): RunSession`、`completeCurrentStep(sessionId): Promise<RunSession>`、`skipCurrentStep(sessionId): Promise<RunSession>`、`undoLatestCompletion(sessionId): Promise<RunSession>`、`getResumableSession(): Promise<RunSession | undefined>`。

- [ ] **Step 1: 写入失败的事务一致性测试**

```ts
// src/domain/runSessionService.test.ts
it('完成采集步骤只写入一条幂等采集记录，撤销时同事务删除', async () => {
  const session = await service.createSession(planWithOneCollectStep)
  await service.completeCurrentStep(session.id)
  await service.completeCurrentStep(session.id)
  expect(await repository.listRecords()).toHaveLength(1)
  await service.undoLatestCompletion(session.id)
  expect(await repository.listRecords()).toHaveLength(0)
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/domain/runSessionService.test.ts src/infrastructure/userDataRepository.test.ts`

Expected: FAIL，原因是数据库、仓储和会话服务不存在。

- [ ] **Step 3: 实现 Dexie 表与仓储**

`database.ts` 创建 `sessions`、`collectionRecords`、`preferences` 三张表，其中 `collectionRecords.idempotencyKey` 为主键。测试初始化必须在每个测试前关闭并删除数据库，确保用例互不污染。

```ts
// src/infrastructure/userDataRepository.ts
export type SessionMutation = {
  session: RunSession
  upsertRecord?: CollectionRecord
  deleteRecordKey?: string
}

/** 表示调用方请求了不允许的领域状态迁移。 */
export class DomainError extends Error {
  constructor(public readonly code: 'session-not-found' | 'invalid-transition' | 'nothing-to-undo') {
    super(code)
  }
}

/** 在同一事务中执行会话和采集记录变更，防止刷新状态与步骤状态不一致。 */
export async function transactionallyUpdateSession(
  sessionId: string,
  change: (session: RunSession) => SessionMutation,
): Promise<RunSession> {
  return database.transaction('rw', database.sessions, database.collectionRecords, async () => {
    const session = await database.sessions.get(sessionId)
    if (!session) throw new DomainError('session-not-found')
    const mutation = change(session)
    await database.sessions.put(mutation.session)
    if (mutation.upsertRecord) await database.collectionRecords.put(mutation.upsertRecord)
    if (mutation.deleteRecordKey) await database.collectionRecords.delete(mutation.deleteRecordKey)
    return mutation.session
  })
}
```

- [ ] **Step 4: 实现会话状态机**

`completeCurrentStep` 只推进 `pending` 当前步骤；若为 `collect`，写入以 `${sessionId}:${step.id}` 命名的记录。`skipCurrentStep` 不写记录。`undoLatestCompletion` 只允许撤销该会话最后完成的一步，恢复为 `pending` 并删除同一幂等键记录。无会话、没有可撤销步骤或非法迁移时返回明确领域错误。

- [ ] **Step 5: 验证数据库与状态机**

Run: `npm run test -- --run src/domain/runSessionService.test.ts src/infrastructure/userDataRepository.test.ts`

Expected: PASS；覆盖完成、重复完成、跳过、撤销、重载恢复、非法迁移和事务内写入异常回滚。

- [ ] **Step 6: 提交持久化功能**

```powershell
git add src/domain/runSessionService.ts src/infrastructure src/test
git commit -m "feat: persist resumable run sessions"
```

### Task 5: 实现个人备份和恢复合并

**Files:**
- Create: `src/infrastructure/backupService.ts`, `src/components/BackupPanel.tsx`
- Test: `src/infrastructure/backupService.test.ts`, `src/components/BackupPanel.test.tsx`

**Interfaces:**
- Consumes: `UserDataRepository`、`backupEnvelopeSchema`、浏览器 `File` 与 Blob API。
- Produces: `exportBackup(): Promise<Blob>`、`importBackup(file: File): Promise<BackupImportReport>`。

- [ ] **Step 1: 写入失败的备份边界测试**

```ts
// src/infrastructure/backupService.test.ts
it('拒绝超过 5 MiB 的备份且不改变数据库', async () => {
  const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-large.json', { type: 'application/json' })
  await expect(importBackup(file)).rejects.toMatchObject({ code: 'backup-too-large' })
  expect(await repository.listRecords()).toHaveLength(0)
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/infrastructure/backupService.test.ts src/components/BackupPanel.test.tsx`

Expected: FAIL，原因是备份服务和面板不存在。

- [ ] **Step 3: 实现严格导入和 Blob 导出**

`importBackup` 必须检查 `file.size <= 5 * 1024 * 1024`、UTF-8 解码、严格 Zod Schema 和 `formatVersion === 1`。它在单个 Dexie 事务中按会话 ID、采集记录 `idempotencyKey` 合并；保留本机偏好；同 ID 内容不同的会话保留本机并增加 `conflictedSessionIds`。`exportBackup` 输出格式版本、UTC 导出时间、当前内容包 ID/版本和所有用户数据。

```ts
// src/infrastructure/backupService.ts
/** 将本机用户数据编码为可导入的 JSON 备份 Blob。 */
export async function exportBackup(): Promise<Blob> {
  return new Blob([JSON.stringify(await buildBackupEnvelope())], { type: 'application/json;charset=utf-8' })
}
```

`BackupPanel` 用隐藏的 `<input type="file" accept="application/json,.json">` 读取文件，用带 `download` 属性的临时链接下载 Blob；它必须显示成功数量、冲突数量或可理解的失败原因。

- [ ] **Step 4: 验证备份行为**

Run: `npm run test -- --run src/infrastructure/backupService.test.ts src/components/BackupPanel.test.tsx`

Expected: PASS；覆盖正常导出、合并去重、冲突保留本机、错误 JSON、错误版本与超限文件。

- [ ] **Step 5: 提交备份功能**

```powershell
git add src/infrastructure/backupService.ts src/components/BackupPanel.tsx src/infrastructure src/components
git commit -m "feat: add local backup and merge restore"
```

### Task 6: 实现材料选择、路线摘要和应用状态编排

**Files:**
- Create: `src/state/appStore.ts`, `src/components/MaterialCatalog.tsx`, `src/components/RouteSummary.tsx`, `src/components/ErrorNotice.tsx`
- Modify: `src/app/App.tsx`, `src/app/App.module.css`
- Test: `src/components/MaterialCatalog.test.tsx`, `src/components/RouteSummary.test.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `loadBuiltInContent`、`planRoute`、`createSession`、Zustand 界面状态。
- Produces: 用户可选择材料/区域、看到路线摘要、创建并进入会话。

- [ ] **Step 1: 写入失败的选择到路线流程测试**

```tsx
it('选择材料后展示路线估时并可创建跑图会话', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('checkbox', { name: '薄荷' }))
  expect(screen.getByText(/预计用时/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '开始跑图' }))
  expect(screen.getByRole('heading', { name: '跑图模式' })).toBeInTheDocument()
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/components/MaterialCatalog.test.tsx src/components/RouteSummary.test.tsx src/app/App.test.tsx`

Expected: FAIL，原因是选择、规划与会话界面尚未实现。

- [ ] **Step 3: 实现只含瞬态状态的 Zustand Store**

`appStore.ts` 只能保存所选材料 ID、所选区域、当前视图和当前会话 ID；不得复制 Dexie 数据或内容包。`App` 在启动时加载和验证内置内容；失败时渲染 `ErrorNotice` 并禁用创建路线。

- [ ] **Step 4: 实现目录和路线摘要组件**

`MaterialCatalog` 提供可访问的复选框与区域筛选；`RouteSummary` 显示模板数、步骤数、预计分钟数和无路线原因。点击“开始跑图”时先调用 `planRoute`，成功后调用 `createSession`，失败时保留选择并显示原因。

- [ ] **Step 5: 验证选择流程**

Run: `npm run test -- --run src/components/MaterialCatalog.test.tsx src/components/RouteSummary.test.tsx src/app/App.test.tsx`

Expected: PASS；覆盖单材料、多材料、区域筛选、无路线和内容加载失败。

- [ ] **Step 6: 提交选择与规划 UI**

```powershell
git add src/app src/components src/state
git commit -m "feat: add material selection and route creation"
```

### Task 7: 实现 Leaflet 地图和跑图执行界面

**Files:**
- Create: `src/components/RouteMap.tsx`, `src/components/RunMode.tsx`
- Modify: `src/app/App.tsx`, `src/app/App.module.css`
- Test: `src/components/RouteMap.test.tsx`, `src/components/RunMode.test.tsx`

**Interfaces:**
- Consumes: `RunSession`、`ResolvedRouteStep`、`toLeafletCoordinate`、会话服务。
- Produces: 当前步骤的图层/标记展示，以及完成、跳过、撤销和恢复交互。

- [ ] **Step 1: 写入失败的跑图操作测试**

```tsx
it('完成采集步骤后推进到下一步骤，并允许撤销最近完成项', async () => {
  const user = userEvent.setup()
  render(<RunMode session={session} />)
  await user.click(screen.getByRole('button', { name: '完成此点' }))
  expect(screen.getByText('下一步')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '撤销完成' }))
  expect(screen.getByText('当前步骤')).toBeInTheDocument()
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/components/RouteMap.test.tsx src/components/RunMode.test.tsx`

Expected: FAIL，原因是地图与跑图组件不存在。

- [ ] **Step 3: 实现地图适配器**

`RouteMap` 必须以 `CRS.Simple` 创建地图，加载内置 `route-grid.svg`，仅渲染当前图层的步骤。当前步骤使用独立视觉状态；同图层相邻 `collect`/`teleport` 步骤可连线，跨图层时不连线。组件只调用 `toLeafletCoordinate`，不得自行交换坐标。

- [ ] **Step 4: 实现跑图模式**

`RunMode` 显示当前步骤编号、名称、说明、完成/跳过/撤销按钮和可选官方地图外链。完成和跳过后从仓储重新读取会话；页面重载时 `App` 调用 `getResumableSession` 并展示“继续上次跑图”。

- [ ] **Step 5: 验证地图与会话交互**

Run: `npm run test -- --run src/components/RouteMap.test.tsx src/components/RunMode.test.tsx`

Expected: PASS；覆盖坐标适配调用、跨图层不连线、完成、跳过、撤销和恢复入口。

- [ ] **Step 6: 提交跑图界面**

```powershell
git add src/components/RouteMap.tsx src/components/RunMode.tsx src/app
git commit -m "feat: add map based run mode"
```

### Task 8: 显示刷新状态、完成视觉设计并增加端到端测试

**Files:**
- Create: `src/components/RefreshStatus.tsx`, `e2e/run-session.spec.ts`, `e2e/backup.spec.ts`, `playwright.config.ts`
- Modify: `src/app/App.tsx`, `src/styles/tokens.css`, `src/styles/global.css`, `src/app/App.module.css`, `package.json`
- Test: `src/components/RefreshStatus.test.tsx`, `e2e/run-session.spec.ts`, `e2e/backup.spec.ts`

**Interfaces:**
- Consumes: `CollectionRecord`、`getNextAvailableAt`、已完成的应用流程。
- Produces: 材料刷新状态、稳定的桌面布局、可重复运行的浏览器端到端验收。

- [ ] **Step 1: 写入失败的刷新状态组件测试**

```tsx
it('对手工规则显示说明而非猜测时间', () => {
  render(<RefreshStatus estimate={{ kind: 'manual', message: '请按路线备注确认刷新' }} />)
  expect(screen.getByText('请按路线备注确认刷新')).toBeInTheDocument()
  expect(screen.queryByText(/可采集于/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: 验证测试先失败**

Run: `npm run test -- --run src/components/RefreshStatus.test.tsx`

Expected: FAIL，原因是刷新状态组件不存在。

- [ ] **Step 3: 实现刷新状态与桌面视觉**

`RefreshStatus` 对 `known` 显示本地格式化的时间，对 `unknown` 显示“无法估算”，对 `manual` 显示内容包说明。样式使用 CSS 变量提供深色、低干扰的跑图工作台：材料栏、中心地图、右侧当前步骤卡片；所有交互控件具备可见焦点状态和中文可访问名称。

- [ ] **Step 4: 编写主流程端到端测试**

```ts
// e2e/run-session.spec.ts
test('用户可创建、推进并恢复跑图会话', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await page.getByRole('button', { name: '完成此点' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toBeVisible()
})
```

`e2e/backup.spec.ts` 必须上传超过 5 MiB 的文件并断言显示“备份文件过大”，再断言现有会话仍可继续。

- [ ] **Step 5: 验证全套 Web 测试和生产构建**

Run: `npm run test -- --run` then `npx playwright test` then `npm run build`

Expected: 全部 PASS；不允许未处理的控制台错误、外部网络请求或未使用的测试快照。

- [ ] **Step 6: 提交验收与视觉完成项**

```powershell
git add src e2e playwright.config.ts package.json package-lock.json
git commit -m "feat: complete offline material run workflow"
```

### Task 9: 验证 Tauri 桌面构建、最小权限与发布产物

**Files:**
- Modify: `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `README.md`
- Test: Tauri 开发窗口与 Windows 安装包的手工验收记录。

**Interfaces:**
- Consumes: 完整 Web 构建、Tauri 初始化配置。
- Produces: 可安装的 Windows 发行产物与可复现的本地运行说明。

- [ ] **Step 1: 写入安全配置检查命令并确认初始状态**

```powershell
rg -n 'plugin|shell|fs|http|global-shortcut|dangerous' src-tauri
```

Expected: 不包含文件系统、Shell、HTTP、全局快捷键插件或 `dangerous` 开关；能力文件只绑定主窗口的默认核心权限。

- [ ] **Step 2: 写入失败的配置检查脚本**

```ts
// scripts/verify-tauri-security.mjs
import { readFileSync } from 'node:fs'

const config = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const serialized = JSON.stringify(config)
const csp = config.app?.security?.csp
if (serialized.includes('dangerousDisableAssetCspModification')) {
  throw new Error('Tauri 配置包含危险的 CSP 关闭开关')
}
if (config.build?.devUrl !== 'http://localhost:5173') {
  throw new Error('开发服务器地址不是受限的本地 Vite 地址')
}
if (typeof csp !== 'string' || !csp.includes("default-src 'self'")) {
  throw new Error('生产 CSP 缺少自身资源限制')
}
```

- [ ] **Step 3: 验证脚本先失败或缺失**

Run: `node scripts/verify-tauri-security.mjs`

Expected: FAIL，原因是脚本尚不存在。

- [ ] **Step 4: 实现最小安全配置和运行说明**

创建该脚本并把 `npm run verify:tauri-security` 加入 `package.json`。设置生产 CSP 为自身资源与 `data:` 图像白名单，开发服务器 URL 仅在 Tauri 开发配置中存在。`README.md` 写明 Rust MSVC、C++ Build Tools、WebView2 前置条件，以及：

```powershell
npm install
npm run tauri dev
npm run verify:tauri-security
npm run tauri build
```

- [ ] **Step 5: 验证桌面构建**

Run: `npm run verify:tauri-security` then `npm run tauri build`

Expected: 两条命令 PASS；生成 Windows 安装包。安装后断网启动，Expected: 演示内容、地图、会话恢复和备份导出可用。

- [ ] **Step 6: 提交桌面发布配置**

```powershell
git add src-tauri scripts README.md package.json package-lock.json
git commit -m "build: package secure windows desktop app"
```

## Plan Self-Review

- **Spec coverage:** Task 1 覆盖 Windows/Tauri/最小权限与中文注释约束；Task 2 覆盖内容、许可字段、外链、坐标和内置演示数据；Task 3 覆盖模板路线与三类刷新规则；Task 4 覆盖状态机、幂等记录和恢复；Task 5 覆盖 5 MiB 严格备份与合并事务；Task 6-8 覆盖核心用户界面、地图、错误状态、可访问性和端到端流程；Task 9 覆盖 CSP、无插件权限和 Windows 打包。
- **Placeholder scan:** 未发现待办标记、未定标记、模糊处理措辞或未定义接口；每项代码任务列出创建/修改文件、测试、实际接口名和验证命令。
- **Type consistency:** `MapCoordinate`、`RespawnRule`、`RoutePlan`、`RunSession`、`CollectionRecord.idempotencyKey`、`BackupEnvelope` 在任务 2-5 中保持同名；UI 任务只调用任务 2-5 已产出的接口。
