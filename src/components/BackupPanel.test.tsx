import 'fake-indexeddb/auto'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { BackupPanel } from './BackupPanel'
import * as backupService from '../infrastructure/backupService'

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

/** 验证不可见文件输入不占据键盘焦点，具名导入按钮仍可触发文件选择。 */
it('通过具名导入按钮提供键盘可达的文件选择入口', async () => {
  const user = userEvent.setup()
  render(<BackupPanel />)
  const input = screen.getByLabelText('选择备份文件')
  const openFilePicker = vi.spyOn(input, 'click')

  expect(input).toHaveAttribute('tabindex', '-1')
  await user.click(screen.getByRole('button', { name: '导入备份' }))
  expect(openFilePicker).toHaveBeenCalledOnce()
})

/** 验证导出读取尚未返回时卸载组件不会遗留 Blob URL。 */
it('卸载后完成的导出不会创建无主下载链接', async () => {
  let finish: (blob: Blob) => void = () => undefined
  const exporting = vi.spyOn(backupService, 'exportBackup').mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const createUrl = vi.spyOn(URL, 'createObjectURL')
  const user = userEvent.setup()
  const { unmount } = render(<BackupPanel />)
  await user.click(screen.getByRole('button', { name: '导出备份' }))
  unmount()
  await act(async () => finish(new Blob(['{}'])))
  expect(createUrl).not.toHaveBeenCalled()
  createUrl.mockRestore()
  exporting.mockRestore()
})

/** 验证两个异步导出在同批渲染中返回时，旧链接仍被回收。 */
it('并发导出替换链接时回收每个旧 URL', async () => {
  const finishes: Array<(blob: Blob) => void> = []
  const exporting = vi.spyOn(backupService, 'exportBackup').mockImplementation(() => new Promise((resolve) => finishes.push(resolve)))
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second')
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  const user = userEvent.setup()
  const { unmount } = render(<BackupPanel />)
  await user.click(screen.getByRole('button', { name: '导出备份' }))
  await user.click(screen.getByRole('button', { name: '导出备份' }))
  await act(async () => { for (const finish of finishes) finish(new Blob(['{}'])) })
  expect(screen.getByRole('link', { name: '下载备份文件' })).toHaveAttribute('href', 'blob:second')
  expect(revokeUrl).toHaveBeenCalledWith('blob:first')
  unmount()
  expect(revokeUrl).toHaveBeenCalledWith('blob:second')
  createUrl.mockRestore()
  revokeUrl.mockRestore()
  exporting.mockRestore()
})
