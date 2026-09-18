import { expect, test } from '@playwright/test'

/** 验证用户可创建、推进并在刷新页面后恢复本地跑图会话。 */
test('用户可创建、推进并恢复跑图会话', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await page.getByRole('button', { name: '完成此点' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toBeVisible()
})
