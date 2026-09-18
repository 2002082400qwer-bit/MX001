# Task 6 实施报告：材料选择与路线会话

## RED / GREEN 证据

- RED：执行 `npm run test -- --run src/components/MaterialCatalog.test.tsx src/components/RouteSummary.test.tsx src/app/App.test.tsx`，因 `MaterialCatalog`、`RouteSummary` 尚不存在，且占位 App 没有材料复选框和错误提示而失败。
- 会话创建失败分支：暂时移除错误映射后，`创建会话失败时保留材料选择并显示原因` 定向测试失败，无法找到 `role=alert`；恢复映射后通过。
- GREEN：目标测试共 3 文件 7 测试通过。

## 实现范围

- Zustand 仅存材料 ID、区域、视图和当前会话 ID 等瞬态 UI 状态；内容包保留在 App 局部状态。
- App 启动时调用并校验 `loadBuiltInContent`；失败显示 `ErrorNotice` 并禁用创建。
- 材料目录提供中文可访问复选框及区域筛选；路线摘要展示模板数、步骤数、预计用时和无路线原因。
- 创建操作每次先调用 `planRoute`，成功后再通过 `RunSessionService`/repository 创建会话；异常会保留选择并显示原因。
- 未修改 Tauri、Rust、插件、网络或游戏访问路径。

## 验证

- `npm run test -- --run src/components/MaterialCatalog.test.tsx src/components/RouteSummary.test.tsx src/app/App.test.tsx`：3 文件 / 7 测试通过。
- `npm run test -- --run`：12 文件 / 49 测试通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过。
- `git diff --check`：通过，无空白错误。

## SHA 与阻塞

- 源码提交 SHA：`de09a68cc010942f82db34cba11162870a7ca21f`（`feat: add material selection and route creation`）。
- 阻塞：无。Dexie 不需要 App 集成测试：测试注入会话创建函数，生产路径仍由 `RunSessionService(UserDataRepository)` 处理持久化。
