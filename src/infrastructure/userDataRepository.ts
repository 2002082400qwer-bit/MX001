import type { CollectionRecord, RunSession } from '../domain/types'
import { database } from './database'

/** 描述一次会话变更和可选采集记录变更，确保二者能在同一事务中提交。 */
export type SessionMutation = {
  session: RunSession
  upsertRecord?: CollectionRecord
  deleteRecordKey?: string
}

/** 表示调用方请求了不允许的会话领域状态转移。 */
export class DomainError extends Error {
  /** 创建可供界面映射提示的领域错误，参数 code 是稳定的错误码。 */
  constructor(public readonly code: 'session-not-found' | 'invalid-transition' | 'nothing-to-undo') {
    super(code)
    this.name = 'DomainError'
  }
}

/** 在一个读写事务内更新会话并新增或删除采集记录，参数 sessionId 指定会话，change 生成变更内容。 */
export async function transactionallyUpdateSession(
  sessionId: string,
  change: (session: RunSession) => SessionMutation,
): Promise<RunSession> {
  return database.transaction('rw', database.sessions, database.collectionRecords, async () => {
    const session = await database.sessions.get(sessionId)
    if (!session) throw new DomainError('session-not-found')
    const mutation = change(session)
    await database.sessions.put(mutation.session)
    if (mutation.upsertRecord) await database.collectionRecords.put(mutation.upsertRecord)
    if (mutation.deleteRecordKey) await database.collectionRecords.delete(mutation.deleteRecordKey)
    return mutation.session
  })
}

/** 封装用户数据访问，供领域服务调用而不让 UI 直接操作数据库。 */
export class UserDataRepository {
  /** 保存新建会话，参数 session 是已包含路线快照的会话。 */
  async createSession(session: RunSession): Promise<RunSession> {
    await database.sessions.put(session)
    return session
  }

  /** 根据主键读取会话，参数 sessionId 是会话唯一标识。 */
  async getSession(sessionId: string): Promise<RunSession | undefined> {
    return database.sessions.get(sessionId)
  }

  /** 查询最近更新且当前步骤仍待处理的会话，用于应用重载恢复。 */
  async getResumableSession(): Promise<RunSession | undefined> {
    const sessions = await database.sessions.orderBy('updatedAt').reverse().toArray()
    return sessions.find((session) => session.currentStepIndex < session.stepStates.length
      && session.stepStates[session.currentStepIndex] === 'pending')
  }

  /** 以同一事务提交会话与采集记录变更，参数与事务函数一致。 */
  async transactionallyUpdateSession(
    sessionId: string,
    change: (session: RunSession) => SessionMutation,
  ): Promise<RunSession> {
    return transactionallyUpdateSession(sessionId, change)
  }

  /** 读取全部采集记录，供导出和领域测试使用。 */
  async listRecords(): Promise<CollectionRecord[]> {
    return database.collectionRecords.toArray()
  }
}
