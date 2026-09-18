import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { App } from './App'
import type { RoutePlan } from '../domain/types'
import { useAppStore } from '../state/appStore'

/** 每项应用测试前重置全局瞬态界面状态，避免前一会话影响后续场景。 */
beforeEach(() => useAppStore.setState({ selectedMaterialIds: [], regionId: '', view: 'catalog', currentSessionId: undefined }))

/** 验证材料选择会生成路线摘要，并且创建会话后切换到跑图视图。 */
it('选择材料后显示路线估时并可创建跑图会话', async () => {
  const user = userEvent.setup()
  const createSession = vi.fn(async (plan: RoutePlan) => ({ id: 'session-1', routeSnapshot: plan }))
  render(<App createSession={createSession} />)

  await user.click(await screen.findByRole('checkbox', { name: '薄荷' }))
  expect(screen.getByText(/预计用时：4 分钟/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '开始跑图' }))
  expect(await screen.findByRole('heading', { name: '跑图模式' })).toBeInTheDocument()
})

/** 验证内置内容校验失败时会显示错误，并且不允许创建路线。 */
it('内置内容加载失败时显示错误并禁用路线创建', async () => {
  render(<App loadContent={() => ({ ok: false as const, error: { code: 'invalid-built-in-content', message: '内容损坏' } })} />)

  expect(await screen.findByRole('alert')).toHaveTextContent('内容损坏')
  expect(screen.getByRole('button', { name: '开始跑图' })).toBeDisabled()
})

/** 验证会话创建失败时保留材料选择，并将失败原因呈现给用户。 */
it('创建会话失败时保留材料选择并显示原因', async () => {
  const user = userEvent.setup()
  render(<App createSession={async () => { throw new Error('会话保存失败') }} />)

  const mint = await screen.findByRole('checkbox', { name: '薄荷' })
  await user.click(mint)
  await user.click(screen.getByRole('button', { name: '开始跑图' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('会话保存失败')
  expect(mint).toBeChecked()
})

/** 验证用户修改筛选条件后会清除已过期的创建失败提示。 */
it('修改筛选后清除创建会话失败提示', async () => {
  const user = userEvent.setup()
  render(<App createSession={async () => { throw new Error('会话保存失败') }} />)

  const mint = await screen.findByRole('checkbox', { name: '薄荷' })
  await user.click(mint)
  await user.click(screen.getByRole('button', { name: '开始跑图' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('会话保存失败')
  await user.click(mint)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

/** 验证应用重载时只通过会话服务发现可恢复会话，并提供明确的恢复入口。 */
it('发现可恢复会话时显示继续上次跑图入口', async () => {
  const service = { getResumableSession: vi.fn(async () => ({
    id: 'resume-1', currentStepIndex: 0, stepStates: ['pending' as const], startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    routeSnapshot: { id: 'route-1', templateIds: [], estimatedMinutes: 1, steps: [{ id: 'step-1', kind: 'note' as const, title: '继续点', message: '说明' }] },
  })) }
  render(<App sessionService={service} />)

  expect(await screen.findByRole('button', { name: '继续上次跑图' })).toBeInTheDocument()
})
