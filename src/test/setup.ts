import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

/** 每个测试结束后清理渲染容器，避免界面状态泄漏到下一项断言。 */
afterEach(() => cleanup())
