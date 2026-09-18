import { defineConfig, devices } from '@playwright/test'

/** 配置离线前端端到端测试，webServer 参数启动本地 Vite 服务。 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
})
