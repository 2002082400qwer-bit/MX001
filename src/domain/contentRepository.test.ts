import { expect, it } from 'vitest'
import { loadBuiltInContent, parseBackupEnvelope } from './contentRepository'

it('返回经过校验的内置演示内容', () => {
  const result = loadBuiltInContent()
  expect(result).toMatchObject({ ok: true })
  if (!result.ok) throw new Error('内置内容应当有效')
  expect(result.value.locationPoints).toHaveLength(6)
})

it('拒绝损坏的备份 JSON', () => {
  expect(() => parseBackupEnvelope('{')).toThrow()
})
