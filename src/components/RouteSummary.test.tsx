import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { RouteSummary } from './RouteSummary'

/** 验证摘要展示已规划路线的模板、步骤与估时，并可触发创建。 */
it('展示已规划路线的模板数步骤数和预计用时', async () => {
  const onCreate = vi.fn()
  render(<RouteSummary result={{ kind: 'planned', plan: { id: 'route', templateIds: ['a', 'b'], estimatedMinutes: 9, steps: [{ id: 'step', kind: 'note', title: '提示' }] } }} disabled={false} onCreate={onCreate} />)

  expect(screen.getByText('模板数：2')).toBeInTheDocument()
  expect(screen.getByText('步骤数：1')).toBeInTheDocument()
  expect(screen.getByText('预计用时：9 分钟')).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: '开始跑图' }))
  expect(onCreate).toHaveBeenCalledOnce()
})

/** 验证没有匹配路线时向用户说明原因而不提供创建入口。 */
it('显示无路线原因', () => {
  render(<RouteSummary result={{ kind: 'no-route', reason: 'missing-template' }} disabled={false} onCreate={vi.fn()} />)

  expect(screen.getByText('没有与当前材料和区域匹配的路线。')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '开始跑图' })).not.toBeInTheDocument()
})
