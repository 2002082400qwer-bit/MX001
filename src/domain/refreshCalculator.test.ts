import { describe, expect, it } from 'vitest'
import { getNextAvailableAt } from './refreshCalculator'

describe('getNextAvailableAt', () => {
  it('按 UTC 采集时间计算持续型刷新时间', () => {
    expect(getNextAvailableAt(
      { kind: 'duration', hours: 48 },
      '2026-09-17T00:00:00.000Z',
      new Date('2026-09-18T00:00:00.000Z'),
    )).toEqual({ kind: 'known', availableAt: '2026-09-19T00:00:00.000Z', isAvailable: false })
  })

  it('返回手动刷新提示', () => {
    expect(getNextAvailableAt(
      { kind: 'manual', message: '请在游戏内确认' },
      '2026-09-17T00:00:00.000Z',
      new Date('2026-09-17T00:00:00.000Z'),
    )).toEqual({ kind: 'manual', message: '请在游戏内确认' })
  })

  it('选择采集时刻之后的下一次每日重置而非同一时刻', () => {
    expect(getNextAvailableAt(
      { kind: 'dailyReset', timeZone: 'Asia/Shanghai', hour: 4, minute: 0 },
      '2026-09-16T20:00:00.000Z',
      new Date('2026-09-17T19:59:59.000Z'),
    )).toEqual({ kind: 'known', availableAt: '2026-09-17T20:00:00.000Z', isAvailable: false })
  })

  it('遇到无效采集时间、时区、时分或未知规则时返回未知', () => {
    expect(getNextAvailableAt({ kind: 'duration', hours: 48 }, 'not-an-iso-date', new Date()))
      .toEqual({ kind: 'unknown' })
    expect(getNextAvailableAt(
      { kind: 'dailyReset', timeZone: 'Invalid/Zone', hour: 4, minute: 0 },
      '2026-09-17T00:00:00.000Z',
      new Date(),
    )).toEqual({ kind: 'unknown' })
    expect(getNextAvailableAt(
      { kind: 'dailyReset', timeZone: 'UTC', hour: 24, minute: 0 },
      '2026-09-17T00:00:00.000Z',
      new Date(),
    )).toEqual({ kind: 'unknown' })
    expect(getNextAvailableAt(
      { kind: 'unexpected' } as never,
      '2026-09-17T00:00:00.000Z',
      new Date(),
    )).toEqual({ kind: 'unknown' })
  })
})
