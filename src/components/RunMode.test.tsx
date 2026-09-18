import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { RunSession } from '../domain/types'
import { RunMode } from './RunMode'

const session: RunSession = {
  id: 'session-1', currentStepIndex: 0, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  stepStates: ['pending', 'pending'],
  routeSnapshot: {
    id: 'route-1', templateIds: [], estimatedMinutes: 1,
    steps: [
      { id: 'collect-1', kind: 'collect', title: '薄荷', message: '采集说明', mapLayerId: 'layer-a', coordinate: { x: 10, y: 20 }, externalMapUrl: 'https://act.hoyolab.com/' },
      { id: 'collect-2', kind: 'collect', title: '下一步', message: '继续采集', mapLayerId: 'layer-a', coordinate: { x: 30, y: 40 } },
    ],
  },
}

/** 创建可观测会话服务替身，模拟持久化命令完成后的重新读取。 */
function createService() {
  let current = session
  return {
    completeCurrentStep: vi.fn(async () => { current = { ...session, currentStepIndex: 1, stepStates: ['completed', 'pending'] }; return current }),
    skipCurrentStep: vi.fn(async () => current),
    undoLatestCompletion: vi.fn(async () => { current = session; return current }),
    getResumableSession: vi.fn(async () => current),
  }
}

it('完成采集步骤后重新读取下一步，并允许撤销最近完成项', async () => {
  const user = userEvent.setup()
  const service = createService()
  render(<RunMode session={session} service={service} />)

  await user.click(screen.getByRole('button', { name: '完成此点' }))
  expect(await screen.findByRole('heading', { name: '2. 下一步' })).toBeInTheDocument()
  expect(service.getResumableSession).toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '撤销完成' }))
  expect(await screen.findByText('当前步骤')).toBeInTheDocument()
})

it('仅在用户点击时显示官方地图外链', async () => {
  const user = userEvent.setup()
  render(<RunMode session={session} service={createService()} />)

  expect(screen.queryByRole('link', { name: '打开官方地图' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '显示官方地图链接' }))
  expect(screen.getByRole('link', { name: '打开官方地图' })).toHaveAttribute('href', 'https://act.hoyolab.com/')
})
