import { expect, it } from 'vitest'
import { backupEnvelopeSchema, contentPackageSchema } from './schemas'
import type { BackupEnvelope } from './types'
import validContent from '../content/demo-content.json'

it('拒绝非 HoYoLAB 外链', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://example.com'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝 HoYoLAB 的非默认端口外链', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://act.hoyolab.com:444/route?area=demo#step'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝 HoYoLAB 外链中的用户名或密码', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://user:password@act.hoyolab.com/route?area=demo#step'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('接受合成的有效演示内容', () => {
  expect(contentPackageSchema.parse(validContent).materials).toHaveLength(2)
})

it('拒绝超出所属图层边界的点位', () => {
  const invalid = structuredClone(validContent)
  invalid.locationPoints[0].coordinate.x = 1001
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝非 HTTPS 的来源链接', () => {
  const invalid = structuredClone(validContent)
  invalid.locationPoints[0].sourceUrl = 'http://act.hoyolab.com/'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

/** 验证内容版本、实体标识和模板引用不会产生歧义或悬空。 */
it.each(['version', 'material', 'layer', 'point', 'anchor', 'template', 'step', 'materialRef', 'pointRef', 'anchorRef'])('拒绝非法内容关系：%s', (kind) => {
  const invalid = structuredClone(validContent)
  if (kind === 'version') invalid.manifest.schemaVersion = 2
  if (kind === 'material') invalid.materials.push(invalid.materials[0])
  if (kind === 'layer') invalid.mapLayers.push(invalid.mapLayers[0])
  if (kind === 'point') invalid.locationPoints.push(invalid.locationPoints[0])
  if (kind === 'anchor') invalid.teleportAnchors.push(invalid.teleportAnchors[0])
  if (kind === 'template') invalid.routeTemplates.push(invalid.routeTemplates[0])
  if (kind === 'step') invalid.routeTemplates[1].steps.push(invalid.routeTemplates[0].steps[0])
  if (kind === 'materialRef') invalid.routeTemplates[0].materialIds = ['missing']
  if (kind === 'pointRef') invalid.routeTemplates[0].steps.push({ id: 'bad', kind: 'collect', locationPointId: 'missing' })
  if (kind === 'anchorRef') invalid.routeTemplates[0].steps.push({ id: 'bad', kind: 'teleport', anchorId: 'missing' })
  expect(contentPackageSchema.safeParse(invalid).success).toBe(false)
})

/** 构造具有完整采集关系的备份，便于单独破坏每一种约束。 */
function validBackup(): BackupEnvelope {
  return { formatVersion: 1, exportedAt: '2026-09-17T02:00:00.000Z', packageId: 'demo', contentVersion: '1.0.0', preferences: {},
    sessions: [{ id: 's', routeSnapshot: { id: 'p', templateIds: [], estimatedMinutes: 1, steps: [{ id: 'c', kind: 'collect', title: '薄荷', locationPointId: 'point', materialId: 'mint' }] }, currentStepIndex: 1, stepStates: ['completed'], startedAt: '2026-09-17T00:00:00.000Z', updatedAt: '2026-09-17T01:00:00.000Z' }],
    collectionRecords: [{ idempotencyKey: 's:c', sessionId: 's', routeStepId: 'c', locationPointId: 'point', materialId: 'mint', collectedAt: '2026-09-17T01:00:00.000Z', packageId: 'demo', contentVersion: '1.0.0' }] }
}

/** 验证导入会拒绝越界索引、非法状态及不匹配的记录关系。 */
it.each(['index', 'length', 'pending', 'collectIds', 'duplicateStep', 'duplicateSession', 'duplicateRecord', 'key', 'orphan', 'point', 'material', 'skipped', 'missingRecord'])('拒绝非法备份关系：%s', (kind) => {
  const backup = validBackup()
  const session = backup.sessions[0]
  if (kind === 'index') session.currentStepIndex = 2
  if (kind === 'length') session.stepStates = []
  if (kind === 'pending') session.stepStates[0] = 'pending'
  if (kind === 'collectIds') delete session.routeSnapshot.steps[0].locationPointId
  if (kind === 'duplicateStep') session.routeSnapshot.steps.push(session.routeSnapshot.steps[0])
  if (kind === 'duplicateSession') backup.sessions.push(session)
  if (kind === 'duplicateRecord') backup.collectionRecords.push(backup.collectionRecords[0])
  if (kind === 'key') backup.collectionRecords[0].idempotencyKey = 'wrong'
  if (kind === 'orphan') backup.collectionRecords[0].sessionId = 'missing'
  if (kind === 'point') backup.collectionRecords[0].locationPointId = 'wrong'
  if (kind === 'material') backup.collectionRecords[0].materialId = 'wrong'
  if (kind === 'skipped') session.stepStates[0] = 'skipped'
  if (kind === 'missingRecord') backup.collectionRecords = []
  expect(backupEnvelopeSchema.safeParse(backup).success).toBe(false)
})

it('有效备份可以导入', () => expect(backupEnvelopeSchema.safeParse(validBackup()).success).toBe(true))
