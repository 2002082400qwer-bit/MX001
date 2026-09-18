# Task 9：Tauri 安全与发布验证记录

## 实施内容

- 新增 `scripts/verify-tauri-security.mjs`，解析 Tauri 主配置和默认 capability；拒绝关闭 CSP 的危险开关、生产 CSP 中的远程来源，以及除 `core:default` 外的权限。
- 新增 `npm run verify:tauri-security`；生产 CSP 仅允许自身资源和 `data:` 图片，禁用对象加载并限制 base URI、表单提交。开发 CSP 只额外允许本地 Vite 开发服务器。
- 新增黑盒 Vitest 用例。RED 阶段脚本尚不存在，命令以 `MODULE_NOT_FOUND` 失败；GREEN 阶段脚本对关闭 CSP 与 Shell 权限 fixture 返回包含 CSP/权限信息的失败结果。
- 新增 README，说明 Windows 前置条件、Web 验证命令与桌面验证命令。

## 外部验证阻塞

未执行 `npm run tauri dev` 或 `npm run tauri build`。当前 Windows Enterprise Code Integrity 策略阻止 `rustc` 启动并报告 `os error 4551`；这属于主机策略而非项目配置，未尝试规避或修改该策略。策略解除后，需在安装 Rust MSVC、C++ Build Tools 和 WebView2 Runtime 的 Windows 机器上执行这两项桌面验证。

## 验证记录

- `npm run verify:tauri-security`：通过。
- `npx vitest run src/tauriSecurity.test.ts`：1/1 通过。
- `npx vitest run`：64/64 通过。
- `npm run test:e2e`：2/2 通过。
- `npm run build`：通过。Vite 报告现有主 JS chunk 超过 500 kB 的性能建议，不影响构建结果。
- `git diff --check`：通过。
- `rg -n -i "plugin|shell|fs:|http|global-shortcut|dangerous" src-tauri`：仅发现本地开发 URL/CSP 及 Cargo 文档链接，没有 capability 插件授权。
- Node JSON 解析：`tauri.conf.json` 与 `capabilities/default.json` 均可解析。
