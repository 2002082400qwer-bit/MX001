# 原神跑图采集材料工具设计说明

## 1. 目标与边界

本项目是一个仅面向 Windows PC、免费自用的原神跑图采集材料桌面工具。首版目标是让用户从“选择材料”快速进入一条可执行路线，并在跑图期间保存完成状态、支持中断后续跑，以及根据采集记录计算下次可采集时间。

首版不包含账号、云同步、移动端、社区投稿、游戏自动化、读写游戏内存、读取游戏画面、游戏控制或第三方地图接口抓取。应用不会要求 HoYoLAB Cookie，也不会镜像官方或第三方地图瓦片。

为了避免未经授权地再分发游戏资产或社区数据库，仓库仅放入自行制作的网格示意地图与演示内容包。真实材料、点位、路线及地图图片应通过可追溯、人工复核且具备明确授权声明的内容包加入；每条点位记录保留来源链接、来源类别、许可证声明、验证时间、游戏版本与可信度字段。首版不提供外部内容包导入界面。点位可附“在官方地图中查看”的外链，但应用不读取该页面的数据。

## 2. 技术选型

| 层级 | 选择 | 原因 |
|---|---|---|
| 桌面宿主 | Tauri 2 | 适合 Windows 本地桌面分发；首版只使用桌面宿主与安全配置，未来再按需增加原生能力。 |
| 前端 | React + TypeScript（严格模式）+ Vite | 组件生态成熟，类型约束适合较多状态与数据模型，Vite 与 Tauri 的 SPA 集成直接。 |
| 样式 | 原生 CSS、CSS 变量与模块化样式 | 视觉需求有限，避免为首版引入完整组件库或大型样式框架。 |
| 地图 | Leaflet + React-Leaflet，使用 `CRS.Simple` | 支持非地理坐标与本地图片叠加，适合游戏地图。 |
| 应用状态 | Zustand | 用于短生命周期的界面与跑图交互状态，避免让组件树承担跨页面状态。 |
| 本地数据库 | Dexie / IndexedDB | 保存路线会话、采集记录与设置，无需后端。 |
| 校验 | Zod | 在内置内容加载与备份导入边界校验 JSON，防止坏数据进入路线规划和持久化。 |
| 时区计算 | Luxon | 用 IANA 时区可靠地计算 `dailyReset` 规则，避免浏览器本地时区影响结果。 |
| 测试 | Vitest、React Testing Library、Playwright | 分别覆盖领域规则、组件交互与主用户流程。 |
| 包管理 | npm | 当前环境已可用，首版不额外依赖 Corepack 或 pnpm。 |

首版 Rust 不暴露任何应用自定义命令，只负责 Tauri 宿主与安全配置。个人数据备份使用标准 Web `File` 输入和 Blob 下载机制，路线、刷新和内容规则全部留在 TypeScript 领域层，使其可独立测试并避免业务逻辑跨语言分散。

## 3. 系统架构

```text
React 表现层
  ├── 材料选择、路线计划、跑图会话、记录与设置界面
  └── Leaflet 地图适配器
                │
应用与领域层
  ├── MaterialCatalog：材料、点位与区域查询
  ├── RoutePlanner：路线模板筛选、拼接与估时
  ├── RunSessionService：创建、恢复、完成与跳过步骤
  └── RefreshCalculator：按规则推算可采集时间
                │
仓储与校验层
  ├── ContentRepository：内置内容包的解析与版本查询
  └── UserDataRepository：Dexie 中的用户记录与设置
                │
基础设施层
  ├── 内置 JSON 内容包与本地图层资源
  ├── IndexedDB
  └── Tauri 桌面生命周期与安全配置
```

表现层不得直接查询 Dexie 或解析 JSON；它只能调用应用服务并渲染返回的视图模型。Leaflet 坐标转换封装在地图适配器内：领域数据始终使用 `{ x, y }`，避免 Leaflet 的 `[y, x]` 表达泄漏到业务代码。

## 4. 核心数据模型

### 4.1 可版本化内容数据

| 实体 | 关键字段 | 用途 |
|---|---|---|
| `ContentManifest` | `packageId`、`schemaVersion`、`contentVersion`、`gameVersion`、`createdAt`、`licenseNotice` | 标记内容包身份、兼容性、版本和授权声明。 |
| `Material` | `id`、`name`、`category`、`respawnRule`、`icon` | 展示材料并提供可判别的刷新规则。 |
| `MapLayer` | `id`、`regionId`、`assetPath`、`bounds`、`externalMapUrl` | 描述可渲染图层、坐标范围与受限的官方地图跳转。 |
| `LocationPoint` | `id`、`materialId`、`mapLayerId`、`coordinate`、`yieldRange`、`conditions`、`sourceUrl`、`sourceKind`、`licenseNotice`、`verifiedAt`、`gameVersion`、`confidence` | 一个可采集点位及其可追溯性。 |
| `TeleportAnchor` | `id`、`mapLayerId`、`coordinate`、`name` | 路线起点和地图标记。 |
| `RouteTemplate` | `id`、`materialIds`、`steps`、`estimatedMinutes`、`requirements` | 人工维护、可解释且有步骤类型的路线顺序。 |

`externalMapUrl` 只允许 `https://act.hoyolab.com/` 主机上的链接，并且只由用户点击后交给系统浏览器打开。`sourceUrl` 是内容溯源文本，首版不在应用内自动打开或请求；它只能使用 HTTPS 协议。内容包的 `licenseNotice` 必须明确该包的授权或“仅本地自用、不得再分发”声明。

坐标统一使用 `MapCoordinate = { x: number, y: number }`：原点位于图层左上角，`x` 向右增长，`y` 向下增长，单位为图层的逻辑网格单位。`MapLayer.bounds` 明确给出 `width` 和 `height`，所有点位必须满足 `0 <= x <= width` 与 `0 <= y <= height`。Leaflet 适配器将它转换为 `[height - y, x]`；不同图层之间不绘制误导性的直线，跑图模式切换图层后只呈现该图层的步骤。

`respawnRule` 是可判别联合类型，而不是自由文本：`duration` 规则包含整数小时数并从实际采集时间起算；`dailyReset` 规则包含 IANA 时区和当天重置时刻；`manual` 规则只显示人工说明且不产生自动提醒。时间一律以 UTC ISO 字符串存储，`dailyReset` 仅在展示与计算时按规则中的时区换算。`yieldRange` 仅作预期产量提示；首版把“完成点位”定义为已采集该点，不记录部分产出。

路线步骤为三种互斥类型：`teleport`（引用一个 `TeleportAnchor`）、`collect`（引用一个 `LocationPoint`）和 `note`（只显示说明）。路线规划后的快照必须保留每个步骤的显示名称、说明、图层 ID、坐标、外链、刷新规则和步骤 ID；因此即使未来内容版本改变，未完成会话仍保有完成所需的最小信息闭包。

### 4.2 本机用户数据

| 实体 | 关键字段 | 用途 |
|---|---|---|
| `RunSession` | `id`、`routeSnapshot`、`currentStepIndex`、`stepStates`、`startedAt`、`updatedAt` | 支持中断、恢复与复盘。 |
| `CollectionRecord` | `idempotencyKey`、`sessionId`、`routeStepId`、`locationPointId`、`materialId`、`collectedAt`、`packageId`、`contentVersion` | 计算刷新时间并留存历史。 |
| `UserPreference` | `defaultRegion`、`mapZoom`、`theme`、`routePreference` | 保存界面和路线偏好。 |
| `BackupEnvelope` | `formatVersion`、`exportedAt`、`packageId`、`contentVersion`、用户数据快照 | 仅存在于导出 JSON 中，用于可验证的个人数据导入导出。 |

首版内容数据随应用发布，并在启动时校验 Schema；用户数据仅属于本机。内容包的图形化导入和在线更新属于后续能力，不进入 MVP，因此不会因半完成的更新流程破坏已有跑图记录。

会话步骤状态只能在 `pending`、`completed`、`skipped` 间迁移。完成 `collect` 步骤时，应用在同一个 Dexie 事务内把步骤标为 `completed` 并以 `sessionId:routeStepId` 作为唯一 `idempotencyKey` 写入采集记录；重复点击不会生成重复记录。完成 `teleport` 或 `note` 步骤不产生采集记录，跳过任意步骤也不产生采集记录。撤销最近一次已完成步骤时，应用在同一事务内把该步骤恢复为 `pending` 并删除对应的唯一采集记录；这样刷新时间始终与会话状态一致。

刷新展示对同一 `locationPointId` 只采用最新一条有效采集记录；`manual` 规则显示内容包中的说明而不计算具体时间。对于 `duration` 和 `dailyReset` 规则，计算失败或规则未知时界面明确显示“无法估算”，不会猜测一个刷新时刻。

备份导入只接受 UTF-8 JSON、最大 5 MiB、严格匹配 `BackupEnvelope` Schema 的文件，不读取其中的路径、脚本或资源。导入策略固定为合并：按会话 ID 与采集记录 `idempotencyKey` 去重，保留本机设置，遇到同 ID 且内容不同的会话保留本机版本并报告冲突。整个导入在单个数据库事务内完成，任何校验或写入失败都不修改本机数据。

## 5. MVP 用户流程

1. 用户在材料目录中选择一种或多种材料，并可限定区域。
2. `RoutePlanner` 优先选择人工路线模板；多材料时仅按区域拼接模板，不做全局最短路优化。
3. 用户查看路线摘要、点位数和估时后创建 `RunSession`。
4. 跑图模式突出当前步骤，在地图上定位点位，支持完成、跳过、撤销最近完成步骤和结束。
5. 每个状态变更立即写入 IndexedDB；重启后可恢复最近未完成会话。
6. 完成点位会写入 `CollectionRecord`，材料页显示基于规则的下次可采时间。
7. 用户可导出个人数据备份，并从已知格式的备份恢复。

MVP 中路线质量优先于算法复杂度。模板路线的每一步必须能说明其来源、前置条件与推荐顺序；动态优化只有在点位和移动成本数据足够可靠后才进入后续版本。

## 6. 模块与接口边界

| 模块 | 公开职责 | 不负责 |
|---|---|---|
| `content` | 校验并提供内置内容包 | 用户进度、地图 UI、网络抓取。 |
| `catalog` | 按材料、区域和条件查询点位 | 路线状态保存。 |
| `routing` | 从模板产生可执行 `RoutePlan` | 直接写数据库或操作地图。 |
| `sessions` | 创建和推进 `RunSession` | 决定地图图层渲染。 |
| `refresh` | 由采集记录和规则计算可采时间 | 发系统通知。 |
| `persistence` | 用户数据事务、导入和导出 | 领域规则判断。 |
| `map` | 将领域坐标与图层转换为 Leaflet 标记和路线线段 | 内容校验或路线计算。 |
| `tauri` | 桌面生命周期、CSP 与最小权限配置 | 业务规则、文件系统访问或内容更新。 |

## 7. 故障处理与数据保护

- 内置内容不符合 Schema、版本不兼容、图层越界、外链不为受允许的 HTTPS HoYoLAB 域名，或引用的图层缺失时，阻止创建路线并显示可理解的诊断信息；此状态不会影响既有个人数据。
- 无法创建路线时，明确说明是材料无路线、筛选条件过严还是内容包缺少点位。
- IndexedDB 写入失败时，保留界面中的未提交状态、提示用户导出或重试，不伪造“已保存”结果。
- 导入备份前先校验 UTF-8 编码、5 MiB 上限、严格 Schema 和格式版本；导入采用合并事务，失败时不半覆盖现有数据。
- 路线会话存储的是创建时的路线快照，因此内容包更新后仍可以完成旧会话。
- 外部链接只通过系统浏览器打开，应用不向其传递账号、Cookie 或个人进度。

## 8. 测试策略

- 单元测试：三种刷新规则、路线模板筛选/拼接、完成—撤销—恢复的会话状态转换及幂等记录、内容包 Schema、外链域名与坐标转换。
- 组件测试：材料筛选、路线摘要、跑图操作条、错误提示和恢复入口。
- 端到端测试：选择演示材料 → 创建路线 → 完成/跳过点位 → 撤销最近完成步骤 → 页面重载后恢复 → 查看刷新时间；另覆盖坏内置内容诊断、超限/坏备份与导入冲突。
- 打包验收：在 Windows 上运行 `tauri build`，安装包启动后能加载内置内容，并完成一次本地会话。

## 9. 非目标与后续演进

首版不做多设备同步、账号系统、众包审核、图形化内容包导入、在线更新服务、最短路径图优化、内置官方游戏地图、自动化控制或完整全量材料库。

后续可按价值递进：手工编辑内容包 → 版本化本地内容导入 → 可选云同步 → 审核过的众包数据 → 基于区域图与移动成本的启发式路线优化。任何扩展都必须保持内容数据与用户数据分离。

## 10. 验收标准

- Windows 安装包可离线启动。
- 内置演示内容至少支持材料选择、地图展示、路线创建和跑图会话。
- 运行中完成/跳过状态在重启后正确恢复。
- 采集记录能按内容规则计算并展示下次可采时间。
- 无效内容或超限、冲突的备份导入不破坏现有数据。
- 领域规则具备自动化测试，主用户流程具备端到端验证。
- 所有函数实现处使用中文注释说明用途和参数含义。
