import Dexie, { type EntityTable } from 'dexie'

import type { CollectionRecord, RunSession, UserPreference } from '../domain/types'

/** 表示带固定主键的用户偏好存储结构，value 保存实际偏好内容。 */
export type StoredUserPreference = { id: 'default'; value: UserPreference }

/** 定义本地用户数据的三个 IndexedDB 表，避免 UI 直接依赖 Dexie。 */
export class UserDataDatabase extends Dexie {
  sessions!: EntityTable<RunSession, 'id'>
  collectionRecords!: EntityTable<CollectionRecord, 'idempotencyKey'>
  preferences!: EntityTable<StoredUserPreference, 'id'>

  /** 初始化数据库表结构，参数 name 是 IndexedDB 数据库名称。 */
  constructor(name = 'genshin-material-runner') {
    super(name)
    this.version(1).stores({
      sessions: '&id, updatedAt',
      collectionRecords: '&idempotencyKey, sessionId, routeStepId',
      preferences: '&id',
    })
  }
}

/** 应用唯一的本地用户数据库实例，仅由基础设施层与仓储层使用。 */
export const database = new UserDataDatabase()
