import { useEffect, useMemo, useState } from 'react'
import { ErrorNotice } from '../components/ErrorNotice'
import { BackupPanel } from '../components/BackupPanel'
import { MaterialCatalog } from '../components/MaterialCatalog'
import { RefreshStatus } from '../components/RefreshStatus'
import { RouteMap } from '../components/RouteMap'
import { RunMode } from '../components/RunMode'
import { RouteSummary } from '../components/RouteSummary'
import { loadBuiltInContent } from '../domain/contentRepository'
import { planRoute } from '../domain/routePlanner'
import { getNextAvailableAt } from '../domain/refreshCalculator'
import { RunSessionService } from '../domain/runSessionService'
import type { CollectionRecord, ContentPackage, ContentValidationError, RefreshEstimate, Result, RoutePlan, RunSession } from '../domain/types'
import { UserDataRepository } from '../infrastructure/userDataRepository'
import { useAppStore } from '../state/appStore'
import './App.css'

type AppProps = {
  loadContent?: () => Result<ContentPackage, ContentValidationError>
  createSession?: (plan: RoutePlan) => Promise<{ id: string }>
  sessionService?: Pick<RunSessionService, 'getResumableSession'>
  listCollectionRecords?: () => Promise<CollectionRecord[]>
}

/** 初始化内容与路线会话；参数可注入内容加载和恢复服务以支持界面测试。 */
export function App({ loadContent = loadBuiltInContent, createSession, sessionService, listCollectionRecords }: AppProps) {
  const [content, setContent] = useState<ContentPackage>()
  const [loadError, setLoadError] = useState<string>()
  const [creationError, setCreationError] = useState<string>()
  const [activeSession, setActiveSession] = useState<RunSession>()
  const [resumableSession, setResumableSession] = useState<RunSession>()
  const [records, setRecords] = useState<CollectionRecord[]>([])
  const [dataRevision, setDataRevision] = useState(0)
  const selectedMaterialIds = useAppStore((state) => state.selectedMaterialIds)
  const regionId = useAppStore((state) => state.regionId)
  const view = useAppStore((state) => state.view)
  const setSelectedMaterialIds = useAppStore((state) => state.setSelectedMaterialIds)
  const setRegionId = useAppStore((state) => state.setRegionId)
  const setView = useAppStore((state) => state.setView)
  const setCurrentSessionId = useAppStore((state) => state.setCurrentSessionId)
  const userDataRepository = useMemo(() => new UserDataRepository(), [])
  const runSessionService = useMemo(() => new RunSessionService(userDataRepository), [userDataRepository])

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
    let isCurrent = true
    void service.getResumableSession().then((session) => { if (isCurrent) setResumableSession(session) }).catch(() => { if (isCurrent) setResumableSession(undefined) })
    return () => { isCurrent = false }
  }, [runSessionService, sessionService, dataRevision])

  /** 读取全局持久化采集记录；会话变更、返回目录和导入成功都会重新读取。 */
  useEffect(() => {
    let isCurrent = true
    const readRecords = listCollectionRecords ?? (() => userDataRepository.listRecords())
    void readRecords()
      .then((nextRecords) => { if (isCurrent) setRecords(nextRecords) })
      .catch(() => { if (isCurrent) setRecords([]) })
    return () => { isCurrent = false }
  }, [activeSession, dataRevision, listCollectionRecords, userDataRepository])

  const refreshEstimate = activeSession && content ? getRefreshEstimate(activeSession, content, records) : { kind: 'unknown' as const }

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

  /** 返回材料选择并重新发现可恢复会话；已提交的进度和记录保留在数据库。 */
  function leaveRun(): void {
    setActiveSession(undefined)
    setCurrentSessionId(undefined)
    setView('catalog')
    invalidateUserData()
  }

  /** 使导入或会话退出后的持久化查询失效，立即更新恢复入口与刷新历史。 */
  function invalidateUserData(): void {
    setDataRevision((revision) => revision + 1)
  }

  if (view === 'running') return <main className="app"><header className="app__header"><h1>原神跑图助手</h1><p>离线演示内容包</p><button type="button" onClick={leaveRun}>{activeSession && activeSession.currentStepIndex === activeSession.stepStates.length ? '结束跑图并返回' : '返回材料选择'}</button></header><section className="app__workspace app__workspace--running"><div className="app__map"><h2>跑图模式</h2>{activeSession && content && <RouteMap session={activeSession} mapLayers={content.mapLayers} />}</div><aside className="app__step-card">{activeSession && <><RunMode session={activeSession} service={runSessionService} onSessionChange={updateActiveSession} /><RefreshStatus estimate={refreshEstimate} /></>}</aside></section></main>
  return <main className="app"><header className="app__header"><h1>原神跑图助手</h1><p>离线演示内容包</p></header>{loadError && <ErrorNotice message={loadError} />}<section className="app__workspace"> <aside className="app__materials">{resumableSession && <button type="button" onClick={() => resumeRun(resumableSession)}>继续上次跑图</button>}{content && <MaterialCatalog materials={content.materials} regionIds={regionIds} selectedMaterialIds={selectedMaterialIds} regionId={regionId} onSelectedMaterialIdsChange={changeSelectedMaterialIds} onRegionIdChange={changeRegionId} />}<BackupPanel onImported={invalidateUserData} /></aside><section className="app__route"><RouteSummary result={routeResult} disabled={!content || !routeResult || routeResult.kind !== 'planned'} onCreate={startRun} errorMessage={creationError} />{content && <RefreshHistory content={content} records={records} />}</section></section></main>
}

/** 按点位合并所有会话的记录，参数 records 为持久化记录，返回每点最新一次采集。 */
function latestRecordsByPoint(records: CollectionRecord[]): CollectionRecord[] {
  const latest = new Map<string, CollectionRecord>()
  for (const record of records) {
    const previous = latest.get(record.locationPointId)
    if (!previous || Date.parse(record.collectedAt) > Date.parse(previous.collectedAt)) latest.set(record.locationPointId, record)
  }
  return [...latest.values()]
}

/** 显示跨会话的点位刷新历史，参数 content 提供材料规则，records 提供持久化采集时间。 */
function RefreshHistory({ content, records }: { content: ContentPackage; records: CollectionRecord[] }) {
  const latest = latestRecordsByPoint(records)
  return <section aria-label="采集刷新历史"><h2>采集刷新历史</h2>{latest.length === 0 ? <p>暂无采集记录</p> : <ul>{latest.map((record) => {
    const material = content.materials.find((item) => item.id === record.materialId)
    const estimate = material ? getNextAvailableAt(material.respawnRule, record.collectedAt, new Date()) : { kind: 'unknown' as const }
    return <li key={record.locationPointId}><p>{material?.name ?? record.materialId} · {record.locationPointId}</p><RefreshStatus estimate={estimate} /></li>
  })}</ul>}</section>
}

/** 根据当前或最近完成点位的全局最新记录计算刷新状态，参数均为已加载的内存数据。 */
function getRefreshEstimate(session: RunSession, content: ContentPackage, records: CollectionRecord[]): RefreshEstimate {
  for (let index = session.currentStepIndex; index >= 0; index -= 1) {
    const step = session.routeSnapshot.steps[index]
    if (!step || step.kind !== 'collect') continue
    const record = latestRecordsByPoint(records).find((candidate) => candidate.locationPointId === step.locationPointId)
    const material = record && content.materials.find((candidate) => candidate.id === record.materialId)
    if (record && material) return getNextAvailableAt(material.respawnRule, record.collectedAt, new Date())
  }
  return { kind: 'unknown' }
}

/** 判断创建接口返回值是否包含完整会话快照，参数 value 是外部创建回调的返回对象。 */
function isRunSession(value: { id: string }): value is RunSession {
  return 'routeSnapshot' in value && 'stepStates' in value && 'currentStepIndex' in value
}
