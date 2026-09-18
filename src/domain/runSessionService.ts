import type { CollectionRecord, ResolvedRouteStep, RoutePlan, RunSession } from './types'
import { DomainError, type SessionMutation, UserDataRepository } from '../infrastructure/userDataRepository'

/** 提供当前时间字符串的依赖类型，便于测试和持久化时间统一。 */
export type Now = () => string

/** 提供会话标识的依赖类型，便于保证会话主键唯一。 */
export type SessionIdFactory = () => string

/** 管理路线会话的持久化状态转移，所有记录副作用都委托仓储事务处理。 */
export class RunSessionService {
  /** 创建服务，参数 repository 负责持久化，now 生成时间，createId 生成会话标识。 */
  constructor(
    private readonly repository: UserDataRepository,
    private readonly now: Now = () => new Date().toISOString(),
    private readonly createId: SessionIdFactory = createSessionId,
  ) {}

  /** 从完整路线快照创建可恢复会话，参数 plan 是已解析路线。 */
  async createSession(plan: RoutePlan): Promise<RunSession> {
    const timestamp = this.now()
    const snapshot = structuredClone(plan)
    const session: RunSession = {
      id: this.createId(),
      routeSnapshot: snapshot,
      currentStepIndex: 0,
      stepStates: snapshot.steps.map(() => 'pending'),
      startedAt: timestamp,
      updatedAt: timestamp,
    }
    return this.repository.createSession(session)
  }

  /** 完成当前待处理步骤，参数 sessionId 指定会话；终止会话重复调用会原样返回。 */
  async completeCurrentStep(sessionId: string): Promise<RunSession> {
    const existing = await this.requireSession(sessionId)
    const expectedStepIndex = existing.currentStepIndex

    return this.repository.transactionallyUpdateSession(sessionId, (session) => {
      if (session.currentStepIndex !== expectedStepIndex || session.currentStepIndex >= session.stepStates.length) return { session }
      const step = getCurrentPendingStep(session)
      const updated = transitionCurrentStep(session, 'completed', this.now())
      return step.kind === 'collect'
        ? { session: updated, upsertRecord: createCollectionRecord(updated, step, this.now()) }
        : { session: updated }
    })
  }

  /** 跳过当前待处理步骤，参数 sessionId 指定会话；跳过不产生采集记录。 */
  async skipCurrentStep(sessionId: string): Promise<RunSession> {
    const existing = await this.requireSession(sessionId)
    const expectedStepIndex = existing.currentStepIndex

    return this.repository.transactionallyUpdateSession(sessionId, (session) => {
      if (session.currentStepIndex !== expectedStepIndex) return { session }
      getCurrentPendingStep(session)
      return { session: transitionCurrentStep(session, 'skipped', this.now()) }
    })
  }

  /** 撤销本会话最后一个已完成步骤，参数 sessionId 指定会话，并删除匹配的采集记录。 */
  async undoLatestCompletion(sessionId: string): Promise<RunSession> {
    const existing = await this.requireSession(sessionId)
    const expectedStepIndex = existing.currentStepIndex

    return this.repository.transactionallyUpdateSession(sessionId, (session) => {
      if (session.currentStepIndex !== expectedStepIndex) return { session }
      const stepIndex = findLatestCompletedStepIndex(session)
      if (stepIndex === -1) throw new DomainError('nothing-to-undo')
      const step = session.routeSnapshot.steps[stepIndex]
      const stepStates = [...session.stepStates]
      stepStates[stepIndex] = 'pending'
      const updated = { ...session, currentStepIndex: stepIndex, stepStates, updatedAt: this.now() }
      const mutation: SessionMutation = { session: updated }
      if (step.kind === 'collect') mutation.deleteRecordKey = `${session.id}:${step.id}`
      return mutation
    })
  }

  /** 返回最近一个仍可继续的会话，供应用重载后恢复路线。 */
  async getResumableSession(): Promise<RunSession | undefined> {
    return this.repository.getResumableSession()
  }

  /** 按会话标识读取最新持久化快照，参数 sessionId 是需要精确刷新的会话唯一标识。 */
  async getSession(sessionId: string): Promise<RunSession | undefined> {
    return this.repository.getSession(sessionId)
  }

  /** 确认会话存在，参数 sessionId 是会话唯一标识；缺失时抛出领域错误。 */
  private async requireSession(sessionId: string): Promise<RunSession> {
    const session = await this.repository.getSession(sessionId)
    if (!session) throw new DomainError('session-not-found')
    return session
  }
}

/** 取得当前索引的待处理路线步骤，参数 session 是待转移会话；非法状态抛出领域错误。 */
function getCurrentPendingStep(session: RunSession): RoutePlan['steps'][number] {
  const step = session.routeSnapshot.steps[session.currentStepIndex]
  if (!step || session.stepStates[session.currentStepIndex] !== 'pending') throw new DomainError('invalid-transition')
  return step
}

/** 变更当前步骤状态并向后移动索引，参数 session、state 和 updatedAt 分别表示原会话、目标状态及更新时间。 */
function transitionCurrentStep(
  session: RunSession,
  state: 'completed' | 'skipped',
  updatedAt: string,
): RunSession {
  const stepStates = [...session.stepStates]
  stepStates[session.currentStepIndex] = state
  return { ...session, currentStepIndex: findNextPendingStepIndex(stepStates, session.currentStepIndex), stepStates, updatedAt }
}

/** 查找当前步骤之后的下一个待处理步骤，参数 stepStates 是状态序列，currentStepIndex 是刚转移的索引。 */
function findNextPendingStepIndex(stepStates: RunSession['stepStates'], currentStepIndex: number): number {
  for (let index = currentStepIndex + 1; index < stepStates.length; index += 1) {
    if (stepStates[index] === 'pending') return index
  }
  return stepStates.length
}

/** 查找最后完成步骤的索引，参数 session 是待撤销会话；不存在时返回 -1。 */
function findLatestCompletedStepIndex(session: RunSession): number {
  for (let index = session.stepStates.length - 1; index >= 0; index -= 1) {
    if (session.stepStates[index] === 'completed') return index
  }
  return -1
}

/** 从已完成采集步骤创建幂等采集记录，参数 session、step、collectedAt 分别表示会话、步骤与采集时间。 */
function createCollectionRecord(
  session: RunSession,
  step: ResolvedRouteStep,
  collectedAt: string,
): CollectionRecord {
  if (step.kind !== 'collect' || !step.locationPointId || !step.materialId) throw new DomainError('invalid-transition')
  return {
    idempotencyKey: `${session.id}:${step.id}`,
    sessionId: session.id,
    routeStepId: step.id,
    locationPointId: step.locationPointId,
    materialId: step.materialId,
    collectedAt,
    packageId: session.routeSnapshot.packageId ?? session.routeSnapshot.id,
    contentVersion: session.routeSnapshot.contentVersion ?? 'snapshot',
  }
}

/** 生成浏览器可用的随机会话标识；无随机 UUID 时使用时间与随机数回退。 */
function createSessionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `session:${Date.now()}:${Math.random().toString(36).slice(2)}`
}
