# 原神跑图助手

本地优先的原神材料采集路线工具。Web 版本可独立验证；桌面版本由 Tauri 2 提供宿主。

## 前置条件

- Node.js 24（或项目依赖支持的 LTS 版本）与 npm。
- Windows 桌面打包另需 Rust `stable-x86_64-pc-windows-msvc`、Microsoft C++ Build Tools 和 Microsoft Edge WebView2 Runtime。具体版本和安装方式请以 [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) 为准。

## Web 验证

```powershell
npm ci
npm run test -- --run
npm run test:e2e
npm run build
npm run verify:tauri-security
```

## Tauri 桌面验证（待外部策略解除）

本机 Windows Enterprise Code Integrity 策略阻止 `rustc` 启动，并返回 OS error 4551。因此以下命令未在当前受限机器执行；策略解除后请在具备上述前置条件的 Windows 环境运行。

```powershell
npm run tauri dev
npm run tauri build
```

安全校验会解析生产 CSP 和默认 capability：生产 CSP 仅允许自身资源及 `data:` 图片，capability 仅保留 `core:default`，不包含 Shell、文件系统、HTTP 或全局快捷键插件权限。
