import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { MaterialCatalog } from '../components/MaterialCatalog'
import { RouteMap } from '../components/RouteMap'
import { RunMode } from '../components/RunMode'
import { RouteSummary } from '../components/RouteSummary'
import { loadBuiltInContent } from '../domain/contentRepository'
import { planRoute } from '../domain/routePlanner'
import { RunSessionService } from '../domain/runSessionService'
import type { ContentPackage, ContentValidationError, Result, RoutePlan, RunSession } from '../domain/types'
import { UserDataRepository } from '../infrastructure/userDataRepository'
import { useAppStore } from '../state/appStore'
import './App.css'

type AppProps = {
  loadContent?: () => Result<ContentPackage, ContentValidationError>
  createSession?: (plan: RoutePlan) => Promise<{ id: string }>
  sessionService?: Pick<RunSessionService, 'getResumableSession'>
}

/** 初始化内容与路线会话；参数可注入内容加载和恢复服务以支持界面测试。 */
export function App({ loadContent = loadBuiltInContent, createSession, sessionService }: AppProps) {
  const [content, setContent] = useState<ContentPackage>()
  const [loadError, setLoadError] = useState<string>()
  const [creationError, setCreationError] = useState<string>()
  const [activeSession, setActiveSession] = useState<RunSession>()
  const [resumableSession, setResumableSession] = useState<RunSession>()
  const selectedMaterialIds = useAppStore((state) => state.selectedMaterialIds)
  const regionId = useAppStore((state) => state.regionId)
  const view = useAppStore((state) => state.view)
  const setSelectedMaterialIds = useAppStore((state) => state.setSelectedMaterialIds)
  const setRegionId = useAppStore((state) => state.setRegionId)
  const setView = useAppStore((state) => state.setView)
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId)
  const runSessionService = useMemo(() => new RunSessionService(new UserDataRepository()), [])

  /** 启动时加载并校验内置内容，失败时保留空内容以阻止会话创建。 */
  useEffect(() => {
    const result = loadContent()
    if (!result.ok) { setContent(undefined); setLoadError(result.error.message); return }
    setContent(result.value)
    setLoadError(undefined)
    if (!regionId) setRegionId(result.value.mapLayers[0]?.regionId ?? '')
  }, [loadContent, regionId, setRegionId])

  /** 应用加载后通过会话服务查询可恢复会话，避免界面层直接访问持久化仓储。 */
  useEffect(() => {
    const service = sessionService ?? runSessionService
    void service.getResumableSession().then(setResumableSession).catch(() => setResumableSession(undefined))
  }, [runSessionService, sessionService])

  const routeResult = useMemo(() => content && regionId ? planRoute(content, { materialIds: selectedMaterialIds, regionId }) : undefined, [content, selectedMaterialIds, regionId])
  const regionIds = useMemo(() => [...new Set(content?.mapLayers.map((layer) => layer.regionId) ?? [])], [content])

  /** 先重新规划路线，再委托服务创建会话；失败时保留材料选择和当前视图。 */
  async function startRun(): Promise<void> {
    if (!content || !regionId) return
    const result = planRoute(content, { materialIds: selectedMaterialIds, regionId })
    if (result.kind === 'no-route') return
    try {
      const create = createSession ?? ((plan: RoutePlan) => runSessionService.createSession(plan))
      const session = await create(result.plan)
      setCurrentSessionId(session.id)
      if (isRunSession(session)) setActiveSession(session)
      setResumableSession(undefined)
      setCreationError(undefined)
      setView('running')
    } catch (error) { setCreationError(error instanceof Error ? error.message : '创建跑图会话失败。') }
  }

  /** 用户修改材料筛选时同步清除与旧路线绑定的创建失败提示。 */
  function changeSelectedMaterialIds(materialIds: string[]): void {
    setCreationError(undefined)
    setSelectedMaterialIds(materialIds)
  }

  /** 用户切换区域筛选时同步清除与旧路线绑定的创建失败提示。 */
  function changeRegionId(nextRegionId: string): void {
    setCreationError(undefined)
    setRegionId(nextRegionId)
  }

  /** 进入已发现的可恢复会话，参数 session 是启动时由会话服务读取的持久化快照。 */
  function resumeRun(session: RunSession): void {
    setActiveSession(session)
    setResumableSession(undefined)
    setCurrentSessionId(session.id)
    setView('running')
  }

  /** 接收跑图组件重新读取的会话快照，参数 session 是操作后持久化的最新状态。 */
  function updateActiveSession(session: RunSession): void {
    setActiveSession(session)
  }

  if (view === 'running') return <main className="app"><h1>原神跑图助手</h1><h2>跑图模式</h2>{activeSession && <>{content && <RouteMap session={activeSession} mapLayers={content.mapLayers} />}<RunMode session={activeSession} service={runSessionService} onSessionChange={updateActiveSession} /></>}</main>
  return <main className="app"><h1>原神跑图助手</h1>{loadError && <ErrorNotice message={loadError} />}{resumableSession && <button type="button" onClick={() => resumeRun(resumableSession)}>继续上次跑图</button>}{content && <MaterialCatalog materials={content.materials} regionIds={regionIds} selectedMaterialIds={selectedMaterialIds} regionId={regionId} onSelectedMaterialIdsChange={changeSelectedMaterialIds} onRegionIdChange={changeRegionId} />}<RouteSummary result={routeResult} disabled={!content || !routeResult || routeResult.kind !== 'planned'} onCreate={startRun} errorMessage={creationError} /></main>
}

/** 判断创建接口返回值是否包含完整会话快照，参数 value 是外部创建回调的返回对象。 */
function isRunSession(value: { id: string }): value is RunSession {
  return 'routeSnapshot' in value && 'stepStates' in value && 'currentStepIndex' in value
}
