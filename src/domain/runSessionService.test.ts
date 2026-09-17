import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { database } from '../infrastructure/database'
import { DomainError, UserDataRepository } from '../infrastructure/userDataRepository'
import type { RoutePlan } from './types'
import { RunSessionService } from './runSessionService'

/** 创建含采集步骤的路线，用于验证会话状态变化和采集记录。 */
function createCollectPlan(): RoutePlan {
  return {
    id: 'plan-1', templateIds: ['template-1'], estimatedMinutes: 3,
    steps: [
      { id: 'collect-1', kind: 'collect', title: '薄荷', locationPointId: 'point-1', materialId: 'mint' },
    ],
  }
}

/** 创建只含非采集步骤的路线，用于验证跳过不会写入采集记录。 */
function createNotePlan(): RoutePlan {
  return { id: 'plan-2', templateIds: ['template-2'], estimatedMinutes: 1, steps: [{ id: 'note-1', kind: 'note', title: '提示' }] }
}

/** 创建有后续待处理步骤的路线，用于验证跳过只影响当前步骤。 */
function createTwoStepPlan(): RoutePlan {
  return {
    id: 'plan-3', templateIds: ['template-3'], estimatedMinutes: 2,
    steps: [{ id: 'note-1', kind: 'note', title: '提示一' }, { id: 'note-2', kind: 'note', title: '提示二' }],
  }
}

/** 创建两个采集步骤的路线，用于验证并发完成命令不能跨越初始步骤。 */
function createTwoCollectPlan(): RoutePlan {
  return {
    id: 'plan-4', templateIds: ['template-4'], estimatedMinutes: 2,
    steps: [
      { id: 'collect-1', kind: 'collect', title: '薄荷', locationPointId: 'point-1', materialId: 'mint' },
      { id: 'collect-2', kind: 'collect', title: '甜甜花', locationPointId: 'point-2', materialId: 'flower' },
    ],
  }
}

describe('RunSessionService', () => {
  /** 每个用例重建 IndexedDB，确保会话和记录相互隔离。 */
  beforeEach(async () => {
    database.close()
    await database.delete()
    await database.open()
  })

  it('完成采集步骤只写一条幂等采集记录，撤销时同事务删除', async () => {
    const repository = new UserDataRepository()
    const service = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createCollectPlan())

    await service.completeCurrentStep(session.id)
    await service.completeCurrentStep(session.id)
    expect(await repository.listRecords()).toHaveLength(1)
    await service.undoLatestCompletion(session.id)

    expect(await repository.listRecords()).toHaveLength(0)
  })

  it('跳过步骤不写入采集记录', async () => {
    const repository = new UserDataRepository()
    const service = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createCollectPlan())

    const updated = await service.skipCurrentStep(session.id)

    expect(updated.stepStates).toEqual(['skipped'])
    expect(await repository.listRecords()).toHaveLength(0)
  })

  it('跳过当前步骤后推进索引且保留后续步骤为待处理', async () => {
    const service = new RunSessionService(new UserDataRepository(), () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createTwoStepPlan())

    const updated = await service.skipCurrentStep(session.id)

    expect(updated).toMatchObject({ currentStepIndex: 1, stepStates: ['skipped', 'pending'] })
  })

  it('两个从同一初始快照发起的完成命令不会串行完成两个步骤', async () => {
    const repository = new UserDataRepository()
    const service = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createTwoCollectPlan())
    const initial = await repository.getSession(session.id)
    let readCount = 0
    let releaseReads: () => void = () => undefined
    const bothReadsFinished = new Promise<void>((resolve) => { releaseReads = resolve })

    // 让两个命令都取得同一个初始快照后，才允许它们进入各自事务。
    const getSession = vi.spyOn(repository, 'getSession').mockImplementation(async () => {
      readCount += 1
      if (readCount === 2) releaseReads()
      await bothReadsFinished
      return structuredClone(initial)
    })

    const [first, second] = await Promise.all([
      service.completeCurrentStep(session.id),
      service.completeCurrentStep(session.id),
    ])

    expect([first, second].some((result) => result.stepStates[1] === 'pending')).toBe(true)
    getSession.mockRestore()
    expect(await repository.getSession(session.id)).toMatchObject({
      currentStepIndex: 1, stepStates: ['completed', 'pending'],
    })
    expect(await repository.listRecords()).toHaveLength(1)
  })

  it('撤销 completed 后重新完成会跳过后续 skipped 步骤并结束会话', async () => {
    const service = new RunSessionService(new UserDataRepository(), () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createTwoStepPlan())
    await service.completeCurrentStep(session.id)
    await service.skipCurrentStep(session.id)
    await service.undoLatestCompletion(session.id)

    const completed = await service.completeCurrentStep(session.id)

    expect(completed).toMatchObject({ currentStepIndex: 2, stepStates: ['completed', 'skipped'] })
  })

  it('重载后可恢复仍有待处理步骤的完整路线快照', async () => {
    const repository = new UserDataRepository()
    const service = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const plan = createCollectPlan()
    await service.createSession(plan)
    plan.steps[0].title = '被外部修改的标题'
    const reloadedService = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-2')

    expect(await reloadedService.getResumableSession()).toMatchObject({
      id: 'session-1', routeSnapshot: { steps: [{ id: 'collect-1', title: '薄荷' }] },
    })
  })

  it('终止会话重复完成返回原会话且不新增记录', async () => {
    const repository = new UserDataRepository()
    const service = new RunSessionService(repository, () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createCollectPlan())
    const completed = await service.completeCurrentStep(session.id)
    const repeated = await service.completeCurrentStep(session.id)

    expect(repeated).toEqual(completed)
    expect(await repository.listRecords()).toHaveLength(1)
  })

  it('没有已完成步骤时撤销返回明确的领域错误', async () => {
    const service = new RunSessionService(new UserDataRepository(), () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createNotePlan())

    await expect(service.undoLatestCompletion(session.id)).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'nothing-to-undo' }),
    )
  })

  it('跳过已终止会话返回非法状态转移错误', async () => {
    const service = new RunSessionService(new UserDataRepository(), () => '2026-09-17T00:00:00.000Z', () => 'session-1')
    const session = await service.createSession(createNotePlan())
    await service.completeCurrentStep(session.id)

    await expect(service.skipCurrentStep(session.id)).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'invalid-transition' }),
    )
  })

  it('缺失会话返回会话不存在错误', async () => {
    const service = new RunSessionService(new UserDataRepository(), () => '2026-09-17T00:00:00.000Z', () => 'session-1')

    await expect(service.completeCurrentStep('missing')).rejects.toEqual(
      expect.objectContaining<Partial<DomainError>>({ code: 'session-not-found' }),
    )
  })
})
