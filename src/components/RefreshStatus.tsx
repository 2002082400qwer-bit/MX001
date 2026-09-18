import type { RefreshEstimate } from '../domain/types'

type RefreshStatusProps = {
  estimate: RefreshEstimate
}

/** 展示材料的刷新估算，参数 estimate 是领域层已经计算好的刷新结果。 */
export function RefreshStatus({ estimate }: RefreshStatusProps) {
  if (estimate.kind === 'manual') {
    return <section className="refresh-status" aria-label="材料刷新状态"><h3>刷新状态</h3><p>{estimate.message}</p></section>
  }

  if (estimate.kind === 'unknown') {
    return <section className="refresh-status" aria-label="材料刷新状态"><h3>刷新状态</h3><p>无法估算</p></section>
  }

  const availableAt = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(estimate.availableAt))

  return <section className="refresh-status" aria-label="材料刷新状态"><h3>刷新状态</h3><p>{estimate.isAvailable ? '现在可采集' : `可采集于 ${availableAt}`}</p></section>
}
