import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RunSession } from '../domain/types'
import { database } from './database'
import { DomainError, UserDataRepository, transactionallyUpdateSession } from './userDataRepository'

/** 创建用于持久化测试的完整会话快照，参数 id 用于区分测试数据。 */
function createSession(id: string): RunSession {
  return {
    id,
    routeSnapshot: { id: 'plan-1', templateIds: ['template-1'], estimatedMinutes: 1, steps: [] },
    currentStepIndex: 0,
    stepStates: [],
    startedAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  }
}

describe('UserDataRepository', () => {
  /** 每个用例重建 IndexedDB，避免持久化数据互相污染。 */
  beforeEach(async () => {
    database.close()
    await database.delete()
    await database.open()
  })

  it('以幂等键作为采集记录主键保存记录', async () => {
    const repository = new UserDataRepository()

    await repository.createSession(createSession('session-1'))
    await transactionallyUpdateSession('session-1', (session) => ({
      session,
      upsertRecord: {
        idempotencyKey: 'session-1:step-1',
        sessionId: 'session-1',
        routeStepId: 'step-1',
        locationPointId: 'point-1',
        materialId: 'material-1',
        collectedAt: '2026-09-17T00:01:00.000Z',
        packageId: 'demo-package',
        contentVersion: '1.0.0',
      },
    }))

    expect(await repository.listRecords()).toMatchObject([{ idempotencyKey: 'session-1:step-1' }])
  })

  it('在记录写入失败时回滚会话更新', async () => {
    const repository = new UserDataRepository()
    await repository.createSession(createSession('session-1'))
    const recordPut = vi.spyOn(database.collectionRecords, 'put').mockRejectedValueOnce(new Error('write failed'))

    await expect(transactionallyUpdateSession('session-1', (session) => ({
      session: { ...session, currentStepIndex: 1 },
      upsertRecord: {
        idempotencyKey: 'session-1:step-1', sessionId: 'session-1', routeStepId: 'step-1',
        locationPointId: 'point-1', materialId: 'material-1', collectedAt: '2026-09-17T00:01:00.000Z',
        packageId: 'demo-package', contentVersion: '1.0.0',
      },
    }))).rejects.toThrow('write failed')

    expect((await repository.getSession('session-1'))?.currentStepIndex).toBe(0)
    expect(await repository.listRecords()).toHaveLength(0)
    recordPut.mockRestore()
  })

  it('为缺失会话返回明确的领域错误', async () => {
    await expect(transactionallyUpdateSession('missing', (session) => ({ session }))).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'session-not-found' }),
    )
  })
})
