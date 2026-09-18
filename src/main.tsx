import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/global.css'

/** 启动 React 应用并将根组件挂载到 HTML 容器。 */
function mountApplication(container: HTMLElement): void {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('未找到应用挂载容器。')
}

mountApplication(rootElement)
