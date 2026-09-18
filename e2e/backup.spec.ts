import { expect, test } from '@playwright/test'

/** 验证超出大小限制的备份被拒绝，同时保留已有的可恢复会话。 */
test('拒绝过大的备份文件且保留现有会话', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await page.getByRole('button', { name: '完成此点' }).click()
  await expect(page.getByRole('region', { name: '跑图操作' }).getByRole('heading')).toHaveText('2. 薄荷')
  await page.reload()

  await page.getByLabel('选择备份文件').setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })

  await expect(page.getByText('备份文件不能超过 5 MiB。')).toBeVisible()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toBeVisible()
})

/** 验证真实备份导入后无需重载就出现恢复入口。 */
test('导入会话后立即可恢复', async ({ page }) => {
  await page.goto('/')
  const timestamp = '2026-09-17T00:00:00.000Z'
  const envelope = { formatVersion: 1, exportedAt: timestamp, packageId: 'demo', contentVersion: '1.0.0', preferences: {}, collectionRecords: [], sessions: [{ id: 'imported', routeSnapshot: { id: 'route', templateIds: [], estimatedMinutes: 1, steps: [{ id: 'note', kind: 'note', title: '导入的路线' }] }, currentStepIndex: 0, stepStates: ['pending'], startedAt: timestamp, updatedAt: timestamp }] }
  await page.getByLabel('选择备份文件').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(envelope)) })
  await expect(page.getByText(/导入成功/)).toBeVisible()
  await page.getByRole('button', { name: '继续上次跑图' }).click()
  await expect(page.getByRole('heading', { name: '1. 导入的路线' })).toBeVisible()
})
