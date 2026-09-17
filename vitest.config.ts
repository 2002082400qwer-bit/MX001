import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/** Vitest 配置，在浏览器模拟环境中加载 React 组件测试。 */
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'] },
})
