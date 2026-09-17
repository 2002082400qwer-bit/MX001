import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vite 开发服务器配置，隔离 Rust 桌面端目录以避免前端热更新扫描它。 */
export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ['**/src-tauri/**'] } },
})
