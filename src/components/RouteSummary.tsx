import type { RoutePlanResult } from '../domain/types'

type RouteSummaryProps = { result?: RoutePlanResult; disabled: boolean; onCreate: () => void; errorMessage?: string }

/** 显示已规划路线的摘要，或向用户说明无法创建路线的具体原因。 */
export function RouteSummary({ result, disabled, onCreate, errorMessage }: RouteSummaryProps) {
  if (result?.kind === 'no-route') return <p role="status">没有与当前材料和区域匹配的路线。</p>
  if (result?.kind === 'planned') return <section aria-labelledby="route-summary-title"><h2 id="route-summary-title">路线摘要</h2><p>模板数：{result.plan.templateIds.length}</p><p>步骤数：{result.plan.steps.length}</p><p>预计用时：{result.plan.estimatedMinutes} 分钟</p>{errorMessage && <p role="alert">{errorMessage}</p>}<button type="button" disabled={disabled} onClick={onCreate}>开始跑图</button></section>
  return <button type="button" disabled={disabled} onClick={onCreate}>开始跑图</button>
}
