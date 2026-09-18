import { loadBuiltInContent, parseBackupEnvelope } from '../domain/contentRepository'
import { backupEnvelopeProbeSchema } from '../domain/schemas'
import type { BackupEnvelope, CollectionRecord, RunSession, UserPreference } from '../domain/types'
import { database } from './database'
import { UserDataRepository } from './userDataRepository'

const MAX_BACKUP_SIZE = 5 * 1024 * 1024

/** 表示导入备份时可供界面展示的稳定错误代码。 */
export class BackupError extends Error {
  /** 创建备份错误，参数 code 用于界面映射可理解的提示。 */
  constructor(public readonly code: 'backup-too-large' | 'invalid-backup' | 'unsupported-backup-version') {
    super(code)
    this.name = 'BackupError'
  }
}

/** 描述一次备份导入新增数据与保留本机会话冲突的结果。 */
export type BackupImportReport = {
  importedSessionCount: number
  importedRecordCount: number
  conflictedSessionIds: string[]
}

/** 使用浏览器 Blob API 将本机全部用户数据编码为可恢复的 JSON 备份。 */
export async function exportBackup(): Promise<Blob> {
  return new Blob([JSON.stringify(await buildBackupEnvelope())], { type: 'application/json;charset=utf-8' })
}

/** 严格校验浏览器文件并在同一个 Dexie 事务中合并其会话和采集记录。 */
export async function importBackup(file: File): Promise<BackupImportReport> {
  if (file.size > MAX_BACKUP_SIZE) throw new BackupError('backup-too-large')

  const envelope = await readBackupEnvelope(file)
  return database.transaction('rw', database.sessions, database.collectionRecords, async () => {
    const report: BackupImportReport = { importedSessionCount: 0, importedRecordCount: 0, conflictedSessionIds: [] }

    for (const importedSession of envelope.sessions) {
      const localSession = await database.sessions.get(importedSession.id)
      if (!localSession) {
        await database.sessions.put(importedSession)
        report.importedSessionCount += 1
      } else if (!isSameSession(localSession, importedSession)) {
        report.conflictedSessionIds.push(importedSession.id)
      }
    }

    for (const importedRecord of envelope.collectionRecords) {
      const localRecord = await database.collectionRecords.get(importedRecord.idempotencyKey)
      if (!localRecord) {
        await database.collectionRecords.put(importedRecord)
        report.importedRecordCount += 1
      }
    }

    return report
  })
}

/** 读取当前演示内容包标识和全部用户数据，构建严格备份信封。 */
async function buildBackupEnvelope(): Promise<BackupEnvelope> {
  const content = loadBuiltInContent()
  if (!content.ok) throw new BackupError('invalid-backup')

  const repository = new UserDataRepository()
  const [sessions, collectionRecords, storedPreferences] = await Promise.all([
    database.sessions.toArray(),
    repository.listRecords(),
    database.preferences.get('default'),
  ])

  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    packageId: content.value.manifest.packageId,
    contentVersion: content.value.manifest.contentVersion,
    sessions,
    collectionRecords,
    preferences: storedPreferences?.value ?? {},
  }
}

/** 以 fatal UTF-8 解码文件并使用领域 Schema 严格解析备份信封。 */
async function readBackupEnvelope(file: File): Promise<BackupEnvelope> {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new BackupError('invalid-backup')
  }

  let rawValue: unknown
  try {
    rawValue = JSON.parse(text)
  } catch {
    throw new BackupError('invalid-backup')
  }

  const probedEnvelope = backupEnvelopeProbeSchema.safeParse(rawValue)
  if (!probedEnvelope.success) throw new BackupError('invalid-backup')
  if (probedEnvelope.data.formatVersion !== 1) throw new BackupError('unsupported-backup-version')

  try {
    return parseBackupEnvelope(probedEnvelope.data)
  } catch {
    throw new BackupError('invalid-backup')
  }
}

/** 比较两个会话的完整持久化内容，参数分别为本机与导入的会话。 */
function isSameSession(localSession: RunSession, importedSession: RunSession): boolean {
  return toCanonicalJson(localSession) === toCanonicalJson(importedSession)
}

/** 递归排序对象键并保留数组顺序，将 JSON 可持久化值转为稳定字符串用于深比较。 */
function toCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(toCanonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${toCanonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}
