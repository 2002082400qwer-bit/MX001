import { DateTime } from 'luxon'
import type { RefreshEstimate, RespawnRule } from './types'

/** 根据 UTC 采集时刻和刷新规则计算可用时间；参数 rule 为刷新规则，collectedAt 为 ISO 采集时间，now 为当前时间。 */
export function getNextAvailableAt(
  rule: RespawnRule,
  collectedAt: string,
  now: Date,
): RefreshEstimate {
  const collected = DateTime.fromISO(collectedAt, { zone: 'utc' })
  if (!collected.isValid || Number.isNaN(now.getTime())) return { kind: 'unknown' }

  if (rule.kind === 'manual') return { kind: 'manual', message: rule.message }
  if (rule.kind === 'duration') {
    if (!Number.isFinite(rule.hours) || rule.hours <= 0) return { kind: 'unknown' }
    return toKnownEstimate(collected.plus({ hours: rule.hours }), now)
  }
  if (rule.kind === 'dailyReset') {
    const next = nextDailyReset(collected, rule.timeZone, rule.hour, rule.minute)
    return next ? toKnownEstimate(next, now) : { kind: 'unknown' }
  }
  return { kind: 'unknown' }
}

/** 计算采集时刻之后的下一个指定时区每日重置；参数 collected 为 UTC 采集时刻，timeZone、hour、minute 为重置设定。 */
function nextDailyReset(
  collected: DateTime,
  timeZone: string,
  hour: number,
  minute: number,
): DateTime | undefined {
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined
  const local = collected.setZone(timeZone)
  if (!local.isValid) return undefined
  const todayReset = local.startOf('day').set({ hour, minute, second: 0, millisecond: 0 })
  return todayReset.toMillis() > local.toMillis() ? todayReset : todayReset.plus({ days: 1 })
}

/** 将有效的 Luxon 时刻转换为展示估算；参数 next 为下一次刷新时刻，now 为当前时间。 */
function toKnownEstimate(next: DateTime, now: Date): RefreshEstimate {
  const availableAt = next.toUTC().toISO()
  if (!next.isValid || !availableAt) return { kind: 'unknown' }
  return { kind: 'known', availableAt, isAvailable: next.toMillis() <= now.getTime() }
}
