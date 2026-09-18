import { expect, test, type Page } from '@playwright/test'

/** 点击完成并等待持久化后的新标题，参数 page 为浏览器页，避免连续命令命中旧步骤。 */
async function completeStep(page: Page): Promise<void> {
  const title = page.getByRole('region', { name: '跑图操作' }).getByRole('heading')
  const previous = await title.innerText()
  await page.getByRole('button', { name: '完成此点' }).click()
  await expect(title).not.toHaveText(previous)
}

/** 验证用户可创建、推进并在刷新页面后恢复本地跑图会话。 */
test('用户可创建、推进并恢复跑图会话', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await completeStep(page)
  await page.reload()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toBeVisible()
})

/** 验证 Vite 提供本地 Leaflet 样式和可解码标记，不依赖 CDN。 */
test('地图布局和本地标记资源可用', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  const marker = page.locator('.leaflet-marker-icon').first()
  await expect(marker).toBeVisible()
  await expect(marker).toHaveCSS('position', 'absolute')
  await expect.poll(() => marker.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  const source = await marker.getAttribute('src')
  expect(source?.startsWith('data:') || new URL(source!, page.url()).origin === new URL(page.url()).origin).toBe(true)
})

/** 验证暂离会话可恢复，完成后可返回目录、导出并创建下一条路线。 */
test('跑图可以返回目录且完成后可以重新开始', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await page.getByRole('button', { name: '返回材料选择' }).click()
  await page.getByRole('button', { name: '继续上次跑图' }).click()
  for (let index = 0; index < 3; index += 1) await completeStep(page)
  await expect(page.getByRole('heading', { name: '路线已完成' })).toBeVisible()
  await page.getByRole('button', { name: '结束跑图并返回' }).click()
  await expect(page.getByRole('button', { name: '继续上次跑图' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '导出备份' })).toBeVisible()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await expect(page.getByRole('button', { name: '完成此点' })).toBeVisible()
})

/** 验证刷新历史跨页面重载保留，撤销后重新计算，且新会话可看到旧记录。 */
test('刷新历史跨会话持久化并响应撤销', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await completeStep(page)
  await completeStep(page)
  await page.reload()
  const history = page.getByRole('region', { name: '采集刷新历史' })
  await expect(history.getByText(/可采集于/)).toBeVisible()
  await page.getByRole('button', { name: '继续上次跑图' }).click()
  await page.getByRole('button', { name: '撤销完成' }).click()
  await expect(page.getByRole('region', { name: '跑图操作' }).getByRole('heading')).toHaveText('2. 薄荷')
  await page.getByRole('button', { name: '返回材料选择' }).click()
  await expect(history.getByText('暂无采集记录')).toBeVisible()
  await page.getByRole('button', { name: '继续上次跑图' }).click()
  await completeStep(page)
  await completeStep(page)
  await page.getByRole('button', { name: '结束跑图并返回' }).click()
  await page.getByLabel('薄荷').check()
  await page.getByRole('button', { name: '开始跑图' }).click()
  await completeStep(page)
  await expect(page.getByRole('region', { name: '材料刷新状态' }).getByText(/可采集于/)).toBeVisible()
})
