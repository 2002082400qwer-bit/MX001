import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BackupEnvelope, CollectionRecord, RunSession } from '../domain/types'
import { database } from './database'
import { exportBackup, importBackup } from './backupService'

/** 创建符合备份 Schema 的会话数据，参数 id 用于区分测试记录。 */
function createSession(id: string, updatedAt = '2026-09-17T00:00:00.000Z'): RunSession {
  return {
    id,
    routeSnapshot: { id: `plan-${id}`, templateIds: ['template-1'], estimatedMinutes: 1, steps: [{ id: 'step-1', kind: 'collect', title: '采集', locationPointId: 'point-1', materialId: 'material-1' }] },
    currentStepIndex: 1,
    stepStates: ['completed'],
    startedAt: '2026-09-17T00:00:00.000Z',
    updatedAt,
  }
}

/** 创建符合备份 Schema 的采集记录，参数 key 是幂等主键。 */
function createRecord(key: string, sessionId = 'session-1'): CollectionRecord {
  return {
    idempotencyKey: key,
    sessionId,
    routeStepId: 'step-1',
    locationPointId: 'point-1',
    materialId: 'material-1',
    collectedAt: '2026-09-17T00:01:00.000Z',
    packageId: 'local-demo-route-grid',
    contentVersion: '1.0.0',
  }
}

/** 创建由导入接口读取的有效备份文件，参数 changes 覆盖默认备份内容。 */
function createBackupFile(changes: Partial<BackupEnvelope> = {}): File {
  const envelope: BackupEnvelope = {
    formatVersion: 1,
    exportedAt: '2026-09-17T01:00:00.000Z',
    packageId: 'local-demo-route-grid',
    contentVersion: '1.0.0',
    sessions: [createSession('session-1')],
    collectionRecords: [createRecord('session-1:step-1')],
    preferences: { theme: 'dark' },
    ...changes,
  }
  return new File([JSON.stringify(envelope)], 'backup.json', { type: 'application/json' })
}

describe('backupService', () => {
  /** 每个用例重建 IndexedDB，避免本地持久化状态互相影响。 */
  beforeEach(async () => {
    database.close()
    await database.delete()
    await database.open()
  })

  it('导出包含 UTC 时间、当前演示内容包标识和全部用户数据的 JSON Blob', async () => {
    await database.sessions.put(createSession('session-1'))
    await database.collectionRecords.put(createRecord('session-1:step-1'))
    await database.preferences.put({ id: 'default', value: { theme: 'dark' } })

    const backup = await exportBackup()
    const envelope = JSON.parse(await backup.text()) as BackupEnvelope

    expect(backup.type).toBe('application/json;charset=utf-8')
    expect(envelope).toMatchObject({
      formatVersion: 1,
      packageId: 'local-demo-route-grid',
      contentVersion: '1.0.0',
      sessions: [createSession('session-1')],
      collectionRecords: [createRecord('session-1:step-1')],
      preferences: { theme: 'dark' },
    })
    expect(envelope.exportedAt).toMatch(/Z$/)
  })

  it('按会话 ID 和记录幂等键合并导入内容，并报告去重数量', async () => {
    await database.sessions.put(createSession('session-1'))
    await database.collectionRecords.put(createRecord('session-1:step-1'))

    const report = await importBackup(createBackupFile({ sessions: [createSession('session-1'), createSession('session-2')], collectionRecords: [createRecord('session-1:step-1'), createRecord('session-2:step-1', 'session-2')] }))

    expect(report).toMatchObject({ importedSessionCount: 1, importedRecordCount: 1, conflictedSessionIds: [] })
    expect(await database.sessions.count()).toBe(2)
    expect(await database.collectionRecords.count()).toBe(2)
  })

  it('会话 ID 相同且内容不同时时保留本机内容并报告冲突', async () => {
    const localSession = createSession('session-1', '2026-09-17T02:00:00.000Z')
    localSession.currentStepIndex = 0
    localSession.stepStates = ['pending']
    await database.sessions.put(localSession)

    const report = await importBackup(createBackupFile({ sessions: [createSession('session-1')] }))

    expect(report.conflictedSessionIds).toEqual(['session-1'])
    expect(await database.sessions.get('session-1')).toEqual(localSession)
    expect(await database.collectionRecords.count()).toBe(0)
  })

  it('会话内容仅对象属性插入顺序不同时不会报告冲突', async () => {
    const localSession = createSession('session-1')
    const reorderedSession: RunSession = {
      updatedAt: localSession.updatedAt,
      startedAt: localSession.startedAt,
      stepStates: localSession.stepStates,
      currentStepIndex: localSession.currentStepIndex,
      routeSnapshot: { steps: localSession.routeSnapshot.steps, estimatedMinutes: 1, templateIds: ['template-1'], id: 'plan-session-1' },
      id: 'session-1',
    }
    await database.sessions.put(reorderedSession)

    const report = await importBackup(createBackupFile({ sessions: [localSession] }))

    expect(report.conflictedSessionIds).toEqual([])
  })

  it('导入时永不覆盖本机偏好', async () => {
    await database.preferences.put({ id: 'default', value: { theme: 'light' } })

    await importBackup(createBackupFile())

    expect((await database.preferences.get('default'))?.value).toEqual({ theme: 'light' })
  })

  it('拒绝损坏的 JSON 且不改变数据库', async () => {
    await expect(importBackup(new File(['{bad json'], 'broken.json', { type: 'application/json' }))).rejects.toMatchObject({ code: 'invalid-backup' })

    expect(await database.sessions.count()).toBe(0)
    expect(await database.collectionRecords.count()).toBe(0)
  })

  it('拒绝非 UTF-8 文件且不改变数据库', async () => {
    await expect(importBackup(new File([new Uint8Array([0xc3, 0x28])], 'invalid-utf8.json', { type: 'application/json' }))).rejects.toMatchObject({ code: 'invalid-backup' })

    expect(await database.sessions.count()).toBe(0)
  })

  it('拒绝不支持的备份格式版本且不改变数据库', async () => {
    await expect(importBackup(createBackupFile({ formatVersion: 2 as 1 }))).rejects.toMatchObject({ code: 'unsupported-backup-version' })

    expect(await database.sessions.count()).toBe(0)
  })

  it('拒绝超过 5 MiB 的备份且不改变数据库', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-large.json', { type: 'application/json' })

    await expect(importBackup(file)).rejects.toMatchObject({ code: 'backup-too-large' })
    expect(await database.sessions.count()).toBe(0)
    expect(await database.collectionRecords.count()).toBe(0)
  })

  it('事务写入失败时不会半写导入数据', async () => {
    const recordPut = vi.spyOn(database.collectionRecords, 'put').mockRejectedValueOnce(new Error('write failed'))

    await expect(importBackup(createBackupFile())).rejects.toThrow('write failed')

    expect(await database.sessions.count()).toBe(0)
    expect(await database.collectionRecords.count()).toBe(0)
    recordPut.mockRestore()
  })

  it('拒绝含有未知字段的版本 2 备份并不误报版本不支持', async () => {
    const validEnvelope = JSON.parse(await createBackupFile().text()) as BackupEnvelope
    const file = new File([JSON.stringify({ ...validEnvelope, formatVersion: 2, unexpected: true })], 'unexpected-v2.json', { type: 'application/json' })

    await expect(importBackup(file)).rejects.toMatchObject({ code: 'invalid-backup' })
    expect(await database.sessions.count()).toBe(0)
  })
})
