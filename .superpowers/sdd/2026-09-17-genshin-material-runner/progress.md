# SDD ledger - plan: docs/superpowers/plans/2026-09-17-genshin-material-runner.md

## Preflight scan

| 关联任务 | 产出与消费关系 | 发现与处理 |
|---|---|---|
| Task 1 → Task 2 | Task 1 提供 TypeScript、Vitest 与 JSON 模块配置；Task 2 创建领域模型。 | 一致；Task 1 明确开启 `resolveJsonModule`。 |
| Task 2 → Task 3 | Task 2 提供 `ContentPackage`、路线步骤、坐标与刷新类型；Task 3 消费它们。 | 一致；路线规划仅生成快照，不反向访问 UI。 |
| Task 2 → Task 4 | Task 2 提供路线快照类型；Task 4 持久化会话。 | 一致；会话服务不解析 JSON。 |
| Task 3 → Task 4 | Task 3 提供 `RoutePlan`；Task 4 以它创建 `RunSession`。 | 一致；刷新计算不写数据库。 |
| Task 4 → Task 5 | Task 4 提供用户仓储与记录幂等键；Task 5 备份/合并它们。 | 一致；导入必须在同一 Dexie 事务中完成。 |
| Task 4 → Task 6 | Task 4 提供创建与恢复会话接口；Task 6 编排应用界面。 | 一致；UI 不直接查询 Dexie。 |
| Task 5 → Task 8 | Task 5 创建 `BackupPanel`；Task 8 完成应用视觉。 | 原计划未写明主应用挂载位置，已修订为在 Task 8 材料栏底部挂载。 |
| Task 6 → Task 7 | 两任务顺序修改 `App.tsx` 与 `App.module.css`。 | 一致；Task 7 只添加跑图视图与地图，不重构 Task 6 的选择状态。 |
| Task 6/7 → Task 8 | 三任务顺序修改应用布局和样式。 | 一致；Task 8 统一视觉与 E2E 验收。 |
| Task 1 → Task 9 | Task 1 生成 Tauri 配置；Task 9 收紧 CSP 和验证发布。 | 一致；Task 9 不添加插件或自定义 Rust 命令。 |

| 任务自检 | 发现与处理 |
|---|---|
| Task 1 | 原计划含 `git init` 与 `git switch`，但实现已在隔离工作树；已改为保留现有仓库/分支。 |
| Task 2 | `parseBackupEnvelope` 出现在产出接口但未明确实现位置；已指定为纯 Schema 解析函数。 |
| Task 3 | 刷新测试遗漏 `isAvailable`；已修订期望值。 |
| Task 4 | 重复完成终止会话的幂等行为不明确；已定义为返回原会话且不新增记录。 |
| Task 5 | 备份输入边界、合并语义和 5 MiB 上限与设计说明一致。 |
| Task 6 | 只保存界面瞬态状态，符合表现层边界。 |
| Task 7 | 坐标转换只通过领域适配器，符合地图边界。 |
| Task 8 | 已明确挂载备份面板并安装 Chromium 后执行 E2E。 |
| Task 9 | 安全脚本允许唯一的本地 Vite `devUrl`，检查生产 CSP 与危险开关。 |

Ruling: 保留已经建立的 `feature/genshin-material-runner` 隔离工作树，不重复执行计划中的 Git 初始化或分支切换；这是 `using-git-worktrees` 的要求，若判断错误会导致计划在错误分支执行，但已由 Git worktree 检测确认。

Ruling: 在 Task 2 实现纯 `parseBackupEnvelope`，在 Task 5 完成文件读取、5 MiB 上限与事务合并；这保持校验和 I/O 分层，若判断错误会造成内部接口额外一层，但测试会覆盖两侧。

Ruling: `RefreshEstimate.known` 始终包含 `isAvailable`，路线刷新测试据此修订；这让 UI 无需重复比较时间，若判断错误仅影响内部返回结构且没有外部 API 用户。

Ruling: 终止会话上的重复“完成”调用返回原会话并不新增记录；这落实幂等记录承诺，代价是 UI 编程错误不会以异常暴露，但状态和历史不会被污染。

Ruling: 在 Task 8 的材料栏底部挂载 Task 5 的 `BackupPanel`；这让已实现的备份功能进入 MVP 主流程，代价是材料栏空间变窄，但可通过样式折叠处理。

## Task 1

- 实施提交：`b8f90e0`；报告提交：`2334cf4`；计划澄清提交：`ac3819d`。
- 实施者已记录 RED → GREEN 证据；`npm run test -- --run` 与 `npm run build` 均通过。
- 独立审查：Approved，无 Critical、Important 或 Minor 发现；审查范围 `54d4c78..2334cf4`。
- 环境说明：Rust stable MSVC、MSVC Build Tools 与 WebView2 已安装，但企业代码完整性策略（Policy ID `{0283ac0f-fff1-49ae-ada1-8a933130cad6}`）阻止 `rustc.exe`（`os error 4551`），因而未能启动 `tauri dev`。未尝试绕过或修改系统策略；后续桌面端验证保留该外部阻塞。

## Task 2

- 开始基线：`ac3819d`。
- 初始实施提交：`b176c9e`；报告提交：`667c113`。初次独立审查发现外链校验未拒绝非默认端口与 URL 凭据（Important）。
- 第 1 轮修正：`d82d344`；修正报告：`2e46145`。复审 PASS，无新 Critical/Important 问题。领域测试 9/9、全量 Vitest 10/10、生产构建与 `git diff --check` 的实施证据均通过；复审另行确认 schemas 测试 6/6、构建和 diff 检查。

Ruling: `externalMapUrl` 允许 `https://act.hoyolab.com/` 主机内的路径、查询和片段，因为官方地图跳转可能依赖它们；但必须拒绝非默认端口与 URL 用户名/密码。代价是内容作者仍可选择任意官方站内页面，但应用不自动请求或打开它，且点击才交给系统浏览器。

## Task 3

- 开始基线：`2e46145`。
- 初始实施提交：`2ee6c15`；报告提交：`974f101`。初次独立审查发现 note-only 模板可绕过区域筛选（Important）。
- 第 1 轮修正：`fd99e3d`；修正报告：`f8f17a4`。复审 APPROVED，无新阻断/重要回归；实施证据为目标 8/8、全量 18/18、构建和 diff 检查通过，复审额外确认 TypeScript noEmit 与 diff 检查。

Ruling: 缺少任何可解析 teleport/collect 步骤的模板不参与路线规划，因为它没有可验证的区域归属；带有已匹配地理步骤的 note 仍保留在路线中。代价是纯说明模板不能单独作为一条路线，但这符合“材料与区域同时匹配”的语义。

## Task 4

- 开始基线：`f8f17a4`。
- 初始实施：`c513a3a`；报告：`5621530`；上下文记录：`dcfcade`。初次独立审查发现并发命令 TOCTOU 与撤销跨越 skipped 步骤后不可继续两个 Important。
- 第 1 轮修正：`c30c252`；修正报告：`244d4d9`。复审 APPROVE，无新增 in-scope 回归；定向事务/状态机测试 13/13 与 diff 检查已由复审确认，实施报告记录全量 Vitest 31/31、构建和 diff 检查通过。

Ruling: 会话命令以发起时捕获的 `currentStepIndex` 作为事务内乐观校验；索引被其他命令改变时返回事务内最新会话且不再转换。代价是陈旧 UI 操作成为安全 no-op，但避免一次双击或并发操作误推进多个步骤。

Ruling: 步骤状态迁移后的索引跳到后续第一个 `pending`（无则 length），而非简单加一；撤销旧完成步骤后重做能够保留后来 skipped 的选择。代价是 `currentStepIndex` 不再等于“刚变化步骤 + 1”，但始终代表下一可执行步骤，更适合恢复和终止判定。

## Task 5

- 开始基线：`ccb711d`。
- 审查第 1 轮：两个 Important 已修正。备份版本分流先用严格 `backupEnvelopeProbeSchema` 验证完整结构与未知键，再对完整非 1 版本报告不支持；会话冲突比较改为递归排序对象键的规范 JSON 串，数组顺序不变。新增两个 RED 回归用例均稳定失败，GREEN 后目标 12/12、全量 43/43、build 与 diff-check 通过。Blob URL 卸载/替换生命周期竞态为 Minor，已记录到 Task 5 报告，留待最终审查，不在本轮混入。
