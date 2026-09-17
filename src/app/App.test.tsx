import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from './App'

/** 验证根组件会暴露标题与演示内容的用户可见行为。 */
it('展示应用标题和演示内容提示', () => {
  render(<App />)

  expect(screen.getByRole('heading', { name: '原神跑图助手' })).toBeInTheDocument()
  expect(screen.getByText('演示内容区')).toBeInTheDocument()
})
