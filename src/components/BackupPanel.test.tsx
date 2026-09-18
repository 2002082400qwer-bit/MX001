import 'fake-indexeddb/auto'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { BackupPanel } from './BackupPanel'

/** 验证备份面板提供可访问的导入入口和导出下载行为。 */
it('提供中文可访问名称的导入和导出控件', async () => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:backup')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  const user = userEvent.setup()
  render(<BackupPanel />)

  expect(screen.getByLabelText('选择备份文件')).toHaveAttribute('accept', 'application/json,.json')
  await user.click(screen.getByRole('button', { name: '导出备份' }))

  expect(await screen.findByRole('link', { name: '下载备份文件' })).toHaveAttribute('download', 'genshin-material-runner-backup.json')
  expect(createObjectURL).toHaveBeenCalledOnce()
  createObjectURL.mockRestore()
  revokeObjectURL.mockRestore()
})
