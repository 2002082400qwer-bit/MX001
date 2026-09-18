import { create } from 'zustand'

export type AppView = 'catalog' | 'running'

type AppState = {
  selectedMaterialIds: string[]
  regionId: string
  view: AppView
  currentSessionId?: string
  setSelectedMaterialIds: (materialIds: string[]) => void
  setRegionId: (regionId: string) => void
  setView: (view: AppView) => void
  setCurrentSessionId: (sessionId?: string) => void
}

/** 保存材料选择、区域、视图与会话标识等瞬态界面状态，不保存内容包或持久化数据。 */
export const useAppStore = create<AppState>((set) => ({
  selectedMaterialIds: [], regionId: '', view: 'catalog', currentSessionId: undefined,
  /** 更新用户当前选择的材料标识列表。 */
  setSelectedMaterialIds: (selectedMaterialIds) => set({ selectedMaterialIds }),
  /** 更新用户当前筛选的区域标识。 */
  setRegionId: (regionId) => set({ regionId }),
  /** 切换材料目录或跑图会话视图。 */
  setView: (view) => set({ view }),
  /** 记录或清除当前跑图会话标识。 */
  setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
}))
