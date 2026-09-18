import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { MaterialCatalog } from '../components/MaterialCatalog'
import { RouteSummary } from '../components/RouteSummary'
import { loadBuiltInContent } from '../domain/contentRepository'
import { planRoute } from '../domain/routePlanner'
import { RunSessionService } from '../domain/runSessionService'
import type { ContentPackage, ContentValidationError, Result, RoutePlan } from '../domain/types'
import { UserDataRepository } from '../infrastructure/userDataRepository'
import { useAppStore } from '../state/appStore'
import './App.css'

type AppProps = { loadContent?: () => Result<ContentPackage, ContentValidationError>; createSession?: (plan: RoutePlan) => Promise<{ id: string }> }

/** 初始化内置内容、协调路线规划和会话创建，并将持久化工作委托给领域服务。 */
export function App({ loadContent = loadBuiltInContent, createSession }: AppProps) {
  const [content, setContent] = useState<ContentPackage>()
  const [loadError, setLoadError] = useState<string>()
  const [creationError, setCreationError] = useState<string>()
  const selectedMaterialIds = useAppStore((state) => state.selectedMaterialIds)
  const regionId = useAppStore((state) => state.regionId)
  const view = useAppStore((state) => state.view)
  const setSelectedMaterialIds = useAppStore((state) => state.setSelectedMaterialIds)
  const setRegionId = useAppStore((state) => state.setRegionId)
  const setView = useAppStore((state) => state.setView)
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId)

  /** 启动时加载并校验内置内容；失败时保留空内容以阻止会话创建。 */
  useEffect(() => {
    const result = loadContent()
    if (!result.ok) { setContent(undefined); setLoadError(result.error.message); return }
    setContent(result.value)
    setLoadError(undefined)
    if (!regionId) setRegionId(result.value.mapLayers[0]?.regionId ?? '')
  }, [loadContent, regionId, setRegionId])

  const routeResult = useMemo(() => content && regionId ? planRoute(content, { materialIds: selectedMaterialIds, regionId }) : undefined, [content, selectedMaterialIds, regionId])
  const regionIds = useMemo(() => [...new Set(content?.mapLayers.map((layer) => layer.regionId) ?? [])], [content])

  /** 先重新规划路线，再委托服务创建会话；失败时保持材料选择和当前视图。 */
  async function startRun(): Promise<void> {
    if (!content || !regionId) return
    const result = planRoute(content, { materialIds: selectedMaterialIds, regionId })
    if (result.kind === 'no-route') return
    try {
      const create = createSession ?? ((plan: RoutePlan) => new RunSessionService(new UserDataRepository()).createSession(plan))
      const session = await create(result.plan)
      setCurrentSessionId(session.id)
      setCreationError(undefined)
      setView('running')
    } catch (error) { setCreationError(error instanceof Error ? error.message : '创建跑图会话失败。') }
  }

  if (view === 'running') return <main className="app"><h1>原神跑图助手</h1><h2>跑图模式</h2></main>
  return <main className="app"><h1>原神跑图助手</h1>{loadError && <ErrorNotice message={loadError} />}{content && <MaterialCatalog materials={content.materials} regionIds={regionIds} selectedMaterialIds={selectedMaterialIds} regionId={regionId} onSelectedMaterialIdsChange={setSelectedMaterialIds} onRegionIdChange={setRegionId} />}<RouteSummary result={routeResult} disabled={!content || !routeResult || routeResult.kind !== 'planned'} onCreate={startRun} errorMessage={creationError} /></main>
}
