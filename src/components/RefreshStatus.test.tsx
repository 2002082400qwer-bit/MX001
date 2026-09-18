import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { RefreshStatus } from './RefreshStatus'

/** 验证人工刷新规则只展示路线说明，不臆测可采集时间。 */
it('对手工规则显示说明而非猜测时间', () => {
  render(<RefreshStatus estimate={{ kind: 'manual', message: '请按路线备注确认刷新' }} />)

  expect(screen.getByText('请按路线备注确认刷新')).toBeInTheDocument()
  expect(screen.queryByText(/可采集于/)).not.toBeInTheDocument()
})

/** 验证无法估算刷新时间时向用户给出明确状态。 */
it('对未知规则显示无法估算', () => {
  render(<RefreshStatus estimate={{ kind: 'unknown' }} />)

  expect(screen.getByText('无法估算')).toBeInTheDocument()
})

/** 验证已知刷新时间按本地格式展示。 */
it('对已知规则显示本地格式化时间', () => {
  render(<RefreshStatus estimate={{ kind: 'known', availableAt: '2026-09-18T08:30:00.000Z', isAvailable: false }} />)

  expect(screen.getByText(/可采集于/)).toBeInTheDocument()
})
