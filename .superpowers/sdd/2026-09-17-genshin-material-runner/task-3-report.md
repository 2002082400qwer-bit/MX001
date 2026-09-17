# Task 3 实现报告

## RED

- 命令：`npm run test -- --run src/domain/routePlanner.test.ts src/domain/refreshCalculator.test.ts`
- 结果：退出码 `1`；两个测试套件均为 `0 test`。
- 预期失败原因：Vite 无法解析 `./routePlanner` 和 `./refreshCalculator`，因为两个生产模块尚不存在。

## GREEN

- 命令：`npm run test -- --run src/domain/routePlanner.test.ts src/domain/refreshCalculator.test.ts`
- 结果：退出码 `0`；`Test Files 2 passed (2)`、`Tests 7 passed (7)`。

## 覆盖的领域边界

- 只选择材料集合与区域同时匹配的模板，严格按内容包模板原顺序拼接，并去重模板 ID；无候选模板返回 `missing-template`，不做最短路径推测。
- 采集与传送步骤复制标题、坐标、图层、外链、点位或锚点 ID；采集快照还复制材料、说明、来源、条件和刷新规则，防止后续内容包变更影响已计划路线。
- `duration` 基于 ISO UTC 采集时刻计算；`manual` 原样返回提示；`dailyReset` 使用 Luxon 时区计算并严格选择采集时刻之后的下一个重置点。
- 无效 ISO 采集时间、无效时区、无效时分、无效当前时间和未知规则均返回 `{ kind: 'unknown' }`。

## 验证输出

- `npm run test -- --run`：退出码 `0`；`Test Files 6 passed (6)`、`Tests 17 passed (17)`。
- `npm run build`：退出码 `0`；TypeScript 编译和 Vite 生产构建均完成。
- `git diff --check`：退出码 `0`，无空白错误。

## 提交与阻塞

- 源码提交 SHA：`2ee6c15b57859eb7647e95154a7cdb13a6c8ab7d`（`feat: add route planning and refresh rules`）。
- 阻塞：无。为使 TypeScript 能检查 Luxon API，新增开发依赖 `@types/luxon`。

## 审查第 1 轮修正

- RED：新增仅含 `note`、材料匹配但目标区域不匹配的模板用例后，目标测试退出码 `1`；实际错误返回 `planned`，而预期为 `{ kind: 'no-route', reason: 'missing-template' }`。
- 修正：模板解析现在必须至少包含一个已解析且绑定到目标区域的 `teleport` 或 `collect` 步骤；`note` 仍可与这些地理步骤一起保留。
- GREEN：目标测试退出码 `0`，`Test Files 2 passed (2)`、`Tests 8 passed (8)`；全量测试退出码 `0`，`Test Files 6 passed (6)`、`Tests 18 passed (18)`；构建与 `git diff --check` 均退出码 `0`。
- 修正源码提交 SHA：`fd99e3d93162bf706cad548883d8a5c97cdae9fb`（`fix: require geographic route steps`）。
