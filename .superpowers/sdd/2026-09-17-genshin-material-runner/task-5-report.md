# Task 5 实施报告：本地备份与恢复合并

## RED / GREEN 证据

- RED：先新增 `src/infrastructure/backupService.test.ts` 与 `src/components/BackupPanel.test.tsx`，执行
  `npm run test -- --run src/infrastructure/backupService.test.ts src/components/BackupPanel.test.tsx`。
  两个套件均因 `./backupService` 与 `./BackupPanel` 尚不存在而无法解析导入，符合预期；完整输出保存在 `task-5-red.log`。
- GREEN：实现后重新执行同一命令，结果为 `2 files / 10 tests passed`。
- 调试记录：面板测试初次运行时真实导出服务因 jsdom 未提供 IndexedDB 而进入错误提示分支；给该测试文件加入 `fake-indexeddb/auto` 后恢复真实服务集成测试，不使用服务 mock。

## 实现范围

- `exportBackup` 只使用浏览器 `Blob`，输出严格备份信封：格式版本 `1`、UTC `exportedAt`、当前演示包的 `packageId`/`contentVersion`，以及 sessions、collectionRecords 与 preferences。
- `importBackup` 在读文件前拒绝大于 5 MiB 的内容；通过 `TextDecoder('utf-8', { fatal: true })` 严格 UTF-8 解码，随后经 `parseBackupEnvelope` 的严格 Zod Schema 校验。版本不为 `1` 单独返回 `unsupported-backup-version`。
- 合并在一个 Dexie `rw` transaction 中完成：sessions 按 `id` 合并，内容不同的同 ID 会话保留本机并记录 `conflictedSessionIds`；collectionRecords 按 `idempotencyKey` 去重；preferences 从不写入。
- `BackupPanel` 提供有中文可访问名称的隐藏文件输入控件、`application/json,.json` 接受类型，以及临时 Blob 下载链接；它显示导入成功数、冲突数和中文错误原因。
- 未添加 Tauri fs/shell/http 插件、Rust command、网络请求、游戏/屏幕/内存/Cookie 读取或第三方 API/地图访问。

## 覆盖与验证

- 目标测试覆盖：Blob 内容、会话和记录去重、同 ID 会话冲突、本机偏好保留、损坏 JSON、非法 UTF-8、错误版本、超过 5 MiB、事务失败不半写，以及面板的可访问导入与 Blob 下载入口。
- `npm run test -- --run src/infrastructure/backupService.test.ts src/components/BackupPanel.test.tsx`：2 files / 10 tests passed。
- `npm run test -- --run`：10 files / 41 tests passed。
- `npm run build`：TypeScript 编译和 Vite production build passed。
- `git diff --check`：通过，无空白错误。

## SHA 与阻塞

- 源码提交：`96c9f052e3bbefd5d00cd862a42859f4aa6b5207`（`feat: add local backup and merge restore`）。
- 源码文件 SHA-1（提交前对象）：`backupService.ts` `cde5e1b8d2fd36230c511814776107fbc33a3e35`；`backupService.test.ts` `c993b1cf7e7d4ed1e0da1ed772d884e7ce8587e7`；`BackupPanel.tsx` `bf81e8a0082df891f00f2d95ad435cfc6a9ed0bb`；`BackupPanel.test.tsx` `2352749c1491ac98bcd8a5d953aac8eefb29c9b1`。
- 阻塞：无。未触碰 rustc 企业策略。
