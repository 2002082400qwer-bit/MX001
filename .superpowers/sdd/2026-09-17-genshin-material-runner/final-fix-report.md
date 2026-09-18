# 最终审查修正报告

日期：2026-09-18。范围：最终审查 Important 1–8，以及来源版本和 Blob URL 生命周期两项改进。

## 修正内容与回归证据

1. Tauri capability 从错误的 `app.capabilities` 移到 `app.security.capabilities`；安全校验器使用同一路径并拒绝旧位置及额外 capability。以安装的官方 `@tauri-apps/cli/config.schema.json` 中 `AppConfig.security` → `SecurityConfig.capabilities` 为准，`AppConfig.additionalProperties=false`。新增有效配置回归先失败，再通过。
2. RouteMap 引入 Leaflet CSS，使用 Vite 导入本地普通/高清标记和阴影 PNG，显式传给 Icon。Playwright 原先观测标记 position=static，修正后为 absolute，naturalWidth 大于零且资源来自本地或 data URL。
3. 跑图页提供“返回材料选择”，完成后提供“结束跑图并返回”。返回时重新读取可恢复会话，保留已持久化进度。E2E 覆盖暂离恢复、完成返回、备份入口和再次开始。
4. 冲突会话保留本机快照，同时跳过其所有导入记录，防止撤销后重新导入旧备份复活采集记录。回归中本机会话为 pending，导入旧 completed 快照后记录数量必须保持 0。
5. 导入校验会话状态数与快照步数相同、当前索引等于首个 pending 或终止 length，collect 必须有点位和材料 ID，teleport 必须有锚点 ID。备份记录必须引用已完成的采集步骤，点位、材料、幂等键必须一致；每个已完成采集步骤必须有记录。拒绝重复会话、记录、步骤 ID。
6. 目录显示全局采集刷新历史，以点位分组，按实际时间选择最新记录；跑图也读取该点跨会话最新记录。回归覆盖无活动会话、多个会话同点最新记录、重载保留、撤销清除和新会话显示旧记录。
7. BackupPanel 成功导入后通知 App 失效用户数据查询，立即更新可恢复会话与刷新历史。E2E 使用真实 JSON 文件导入后无需页面重载即可恢复。
8. 内容 schemaVersion 限定为 1，验证各实体集合 ID 唯一及跨模板步骤 ID 唯一；验证模板材料、采集点、传送锚点引用以及模板采集材料归属。23 个新增 schema 负例在实现前全部失败，实现后通过。

新路线快照额外保存真实 packageId/contentVersion，采集记录继承该来源；旧快照缺失字段时保留兼容回退，不伪造历史版本。真实内置包规划与采集的集成测试先失败后通过。

Blob 下载链接通过 ref 持有生命周期：卸载后异步导出不再创建 URL，并发导出替换立即回收前一个 URL，卸载回收当前 URL。两个专门回归均先失败后通过。

## 验证

- `npx vitest run`：16 文件，98/98 通过。
- `npx playwright test`：6/6 通过，使用真实 Chromium + Vite + IndexedDB。
- 重复验收曾暴露测试连续点击后立即 reload、未等待 IndexedDB 命令提交的时序问题；现以步骤标题变化确认真实提交后再继续，撤销同样等待恢复到第 2 步。
- 修正测试同步后执行 `npx playwright test --repeat-each=2`，12/12 通过。
- `npm run build`：TypeScript 与生产 Vite 构建通过，PNG 资源类型声明已补齐。
- `npm run verify:tauri-security`：通过。
- `git diff --check`：通过。
- 未运行 Tauri dev/build；保留上游记录的企业策略阻止 rustc 的桌面验证限制。

非阻断提示：生产 JS 约 664 kB，仍有 Vite 500 kB chunk 提示；Playwright 终端有 NO_COLOR/FORCE_COLOR 提示。未改动原有 progress.md 的待提交内容。

参考：官方 Leaflet Quick Start 要求加载 CSS，https://leafletjs.com/examples/quick-start/ 。Tauri 在线文档请求超时，实际配置结构已通过本机安装的官方 JSON Schema 核对。
