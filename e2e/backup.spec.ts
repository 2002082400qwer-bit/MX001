import { expect, test } from '@playwright/test'

/** 验证超出大小限制的备份被拒绝，同时保留已有的可恢复会话。 */
test('拒绝过大的备份文件且保留现有会话', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await page.getByRole('button', { name: '完成此点' }).click()
  await page.reload()

  await page.getByLabel('选择备份文件').setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })

  await expect(page.getByText('备份文件不能超过 5 MiB。')).toBeVisible()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toBeVisible()
})
