import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { MaterialCatalog } from './MaterialCatalog'

const materials = [
  { id: 'mint', name: '薄荷', category: '合成材料', respawnRule: { kind: 'duration' as const, hours: 48 }, icon: 'mint' },
  { id: 'mushroom', name: '蘑菇', category: '合成材料', respawnRule: { kind: 'manual' as const, message: '手动' }, icon: 'mushroom' },
]

/** 验证目录用可访问复选框将多个材料标识回传给调用方。 */
it('通过复选框选择多个材料', async () => {
  const user = userEvent.setup()
  const onSelectedMaterialIdsChange = vi.fn()
  /** 模拟受控父组件，让每次选择都作为下一次选择的输入。 */
  function CatalogHarness() {
    const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([])
    /** 同步受控材料选择并记录组件向外发送的值。 */
    function changeSelection(materialIds: string[]): void { setSelectedMaterialIds(materialIds); onSelectedMaterialIdsChange(materialIds) }
    return <MaterialCatalog materials={materials} regionIds={['demo-region']} selectedMaterialIds={selectedMaterialIds} regionId="demo-region" onSelectedMaterialIdsChange={changeSelection} onRegionIdChange={vi.fn()} />
  }
  render(<CatalogHarness />)

  await user.click(screen.getByRole('checkbox', { name: '薄荷' }))
  await user.click(screen.getByRole('checkbox', { name: '蘑菇' }))
  expect(onSelectedMaterialIdsChange).toHaveBeenLastCalledWith(['mint', 'mushroom'])
})

/** 验证目录提供区域筛选控件并回传选定区域。 */
it('通过区域筛选控件切换区域', async () => {
  const user = userEvent.setup()
  const onRegionIdChange = vi.fn()
  render(<MaterialCatalog materials={materials} regionIds={['demo-region', 'liyue']} selectedMaterialIds={[]} regionId="demo-region" onSelectedMaterialIdsChange={vi.fn()} onRegionIdChange={onRegionIdChange} />)

  await user.selectOptions(screen.getByLabelText('区域筛选'), 'liyue')
  expect(onRegionIdChange).toHaveBeenCalledWith('liyue')
})
