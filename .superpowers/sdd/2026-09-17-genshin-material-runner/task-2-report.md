# Task 2 实施报告

## 结果

- 已创建可严格校验的内容、备份和坐标领域模型。
- 内置内容仅包含自制 `route-grid.svg` 和合成演示数据；未复制、抓取或下载任何游戏或第三方地图资产、点位数据。
- `externalMapUrl` 只接受精确的 `https://act.hoyolab.com` 主机，`sourceUrl` 只接受 HTTPS，点位及传送点均校验所属图层边界。
- `parseBackupEnvelope` 为纯解析函数，不读写文件、数据库或其他外部资源。

## TDD 记录

### RED

命令：

```powershell
npm run test -- --run src/domain/mapCoordinates.test.ts src/domain/schemas.test.ts
```

完整结果：退出码 `1`；Vitest 找到 2 个测试文件但两者均无法解析缺失模块，分别为 `./mapCoordinates` 与 `./schemas`，共 `2 failed`、`0 tests`。失败原因符合预期：领域模块尚未创建。

随后补充内置内容加载与备份损坏 JSON 的行为测试，并执行：

```powershell
npm run test -- --run src/domain/schemas.test.ts src/domain/mapCoordinates.test.ts src/domain/contentRepository.test.ts
```

完整结果：退出码 `1`；三个测试文件分别无法解析缺失的 `./schemas`、`./mapCoordinates` 与 `./contentRepository`，共 `3 failed`、`0 tests`。失败原因符合预期：实现尚不存在。

### GREEN

命令：

```powershell
npm run test -- --run src/domain/schemas.test.ts src/domain/mapCoordinates.test.ts src/domain/contentRepository.test.ts
```

完整结果：退出码 `0`；`3 passed` 测试文件，`7 passed` 测试，耗时约 3.26 秒。

## 最终验证

```powershell
npm run test -- --run
```

退出码 `0`；`4 passed` 测试文件，`8 passed` 测试，耗时约 3.76 秒。

```powershell
npm run build
```

退出码 `0`；`tsc -b && vite build` 成功，Vite 转换 15 个模块并生成生产构建产物。

```powershell
git diff --check
```

退出码 `0`；无输出，未发现空白错误。

## 提交

- SHA：`b176c9e4f7c90d78814c3dd71d81122675b12f0b`
- 信息：`feat: add validated local content model`

## 阻塞

无。
