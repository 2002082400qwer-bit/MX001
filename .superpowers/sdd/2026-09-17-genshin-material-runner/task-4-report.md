# Task 4 实施报告：Dexie 持久化与会话状态机

## RED / GREEN 记录

- RED：先新增 `runSessionService.test.ts` 与 `userDataRepository.test.ts`，执行
  `npm run test -- --run src/domain/runSessionService.test.ts src/infrastructure/userDataRepository.test.ts`。
  两个套件均因 `database`、`userDataRepository`、`runSessionService` 尚不存在而无法解析导入，符合预期。
- GREEN：实现 Dexie 三表、事务仓储与会话服务后，定向测试通过 `2 files / 11 tests`。
- 诊断修正：`createCollectPlan` 已被改为仅一个采集步骤；`skip` 规范只修改当前步骤，故该用例的期望应为 `['skipped']`。另增两步路线用例，验证跳过后 `currentStepIndex` 推进且后续步骤仍为 `pending`。

## 实现范围

- 仅创建 `sessions`、`collectionRecords`、`preferences` 三张 Dexie 表；采集记录以 `idempotencyKey` 为主键。
- 会话与采集记录的新增/删除均通过同一 `rw` Dexie transaction；记录写失败时会话更新回滚。
- 会话保存完整深拷贝 `RoutePlan` / `ResolvedRouteStep` 快照，重载后可读取继续执行的会话。
- 完成仅处理当前 `pending`；采集使用 `${sessionId}:${step.id}` 幂等键；跳过不写记录；撤销最后完成步骤会恢复 `pending` 并删除同一键记录。
- 终止会话重复完成返回原会话且不新增记录；UI 无数据库访问路径，未增加 Tauri、插件、Rust 命令、网络请求或游戏自动化。

## 错误码

- `session-not-found`：会话不存在。
- `invalid-transition`：当前步骤不是可执行的 `pending` 状态，或采集步骤快照不完整。
- `nothing-to-undo`：会话没有已完成步骤可撤销。

## 验证

- `npm run test -- --run src/domain/runSessionService.test.ts src/infrastructure/userDataRepository.test.ts`：2 个文件、11 个测试通过。
- `npm run test -- --run`：8 个文件、29 个测试通过。
- `npm run build`：TypeScript 编译与 Vite 构建通过。
- `git diff --check` 与 `git diff --cached --check`：无空白错误。

## 提交与阻塞

- 源码提交：`c513a3a0945ec10a914b24e7541a37548fee3f83`（`feat: persist resumable run sessions`）。
- 阻塞：无。fake-indexeddb 与 Dexie transaction 集成测试均正常运行。
