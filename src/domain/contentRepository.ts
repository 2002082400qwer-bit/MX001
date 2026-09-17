import demoContent from '../content/demo-content.json'
import { backupEnvelopeSchema, contentPackageSchema } from './schemas'
import type { BackupEnvelope, ContentPackage, ContentValidationError, Result } from './types'

/** 解析并校验随应用发布的合成内容，返回显式结果而不是在导入模块时抛出异常。 */
export function loadBuiltInContent(): Result<ContentPackage, ContentValidationError> {
  const parsed = contentPackageSchema.safeParse(demoContent)
  if (parsed.success) return { ok: true, value: parsed.data }
  return { ok: false, error: { code: 'invalid-built-in-content', message: parsed.error.message } }
}

/** 严格解析未知备份输入；参数 input 为 JSON 字符串或已解析的未知 JSON 值，且本函数不执行 I/O。 */
export function parseBackupEnvelope(input: unknown): BackupEnvelope {
  const value = typeof input === 'string' ? JSON.parse(input) : input
  return backupEnvelopeSchema.parse(value)
}
