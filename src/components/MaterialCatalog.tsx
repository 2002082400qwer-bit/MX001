import type { Material } from '../domain/types'

type MaterialCatalogProps = { materials: Material[]; regionIds: string[]; selectedMaterialIds: string[]; regionId: string; onSelectedMaterialIdsChange: (materialIds: string[]) => void; onRegionIdChange: (regionId: string) => void }

/** 展示可访问的材料复选框与区域筛选控件，并将用户选择回传给父组件。 */
export function MaterialCatalog({ materials, regionIds, selectedMaterialIds, regionId, onSelectedMaterialIdsChange, onRegionIdChange }: MaterialCatalogProps) {
  /** 根据复选框状态增删材料标识，并保持其他已选材料不变。 */
  function toggleMaterial(materialId: string, checked: boolean): void {
    onSelectedMaterialIdsChange(checked ? [...selectedMaterialIds, materialId] : selectedMaterialIds.filter((selectedId) => selectedId !== materialId))
  }
  return <section aria-labelledby="material-catalog-title"><h2 id="material-catalog-title">选择材料</h2><label>区域筛选<select aria-label="区域筛选" value={regionId} onChange={(event) => onRegionIdChange(event.target.value)}>{regionIds.map((candidateRegionId) => <option key={candidateRegionId} value={candidateRegionId}>{candidateRegionId}</option>)}</select></label><fieldset><legend>材料</legend>{materials.map((material) => <label key={material.id}><input type="checkbox" checked={selectedMaterialIds.includes(material.id)} onChange={(event) => toggleMaterial(material.id, event.target.checked)} />{material.name}</label>)}</fieldset></section>
}
