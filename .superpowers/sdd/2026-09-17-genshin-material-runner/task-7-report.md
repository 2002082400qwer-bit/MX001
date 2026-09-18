# Task 7 实施报告：地图跑图界面

## 实施范围

- 新增 `RouteMap`：使用 `Leaflet CRS.Simple`、内置自制 `route-grid.svg`，通过 `toLeafletCoordinate` 转换业务坐标；只绘制当前图层标记，并且只连接同图层相邻的 `collect`/`teleport` 步骤。
- 新增 `RunMode`：显示当前步骤序号、名称和说明；完成、跳过、撤销均通过会话服务执行后重新读取可恢复会话；官方地图链接仅在用户点击后显示。
- 更新 `App`：启动时调用 `getResumableSession` 并提供“继续上次跑图”；跑图操作不直接访问 Dexie。
- 一并修复 Task 6 相邻范围的小问题：用户改变材料或区域筛选后清除过期的创建失败提示。

## TDD 记录

1. 先新增 `RouteMap.test.tsx` 和 `RunMode.test.tsx`。
2. RED 命令：`npm run test -- --run src/components/RouteMap.test.tsx src/components/RunMode.test.tsx`。
3. RED 结果：两个套件均因 `RouteMap`、`RunMode` 模块不存在而失败。
4. 最小实现后，目标测试及 `App.test.tsx` 通过 9 项断言。

## 验证证据

- `npm run test -- --run src/components/RouteMap.test.tsx src/components/RunMode.test.tsx src/app/App.test.tsx`：3 个测试文件、9 项测试通过。
- `npm run test -- --run`：14 个测试文件、55 项测试通过。
- `npm run build`：TypeScript 检查和 Vite 生产构建通过。
- `git diff --check`：退出码 0；仅输出 Git 的 CRLF 转换提示，无空白错误。

## 测试适配说明

`react-leaflet` 在组件单测中以轻量 React 适配器替代，以断言路线组件输出的地图标记和连线；生产代码仍直接使用 Leaflet 的 `CRS.Simple`。该策略避免 jsdom 缺少真实地图容器尺寸带来的生命周期不稳定性。
