import { useEffect, useState } from 'react'
import type { RunSession } from '../domain/types'

export type RunSessionCommands = {
  completeCurrentStep: (sessionId: string) => Promise<RunSession>
  skipCurrentStep: (sessionId: string) => Promise<RunSession>
  undoLatestCompletion: (sessionId: string) => Promise<RunSession>
  getResumableSession: () => Promise<RunSession | undefined>
}

type RunModeProps = {
  session: RunSession
  service: RunSessionCommands
  onSessionChange?: (session: RunSession) => void
}

/** 展示并操作路线会话，参数 session 是初始快照，service 是唯一允许执行会话变更的入口。 */
export function RunMode({ session, service, onSessionChange }: RunModeProps) {
  const [displayedSession, setDisplayedSession] = useState(session)
  const [showExternalMap, setShowExternalMap] = useState(false)
  const [error, setError] = useState<string>()
  const currentStep = displayedSession.routeSnapshot.steps[displayedSession.currentStepIndex]
  const hasCompletedStep = displayedSession.stepStates.includes('completed')

  useEffect(() => { setDisplayedSession(session); setShowExternalMap(false) }, [session])

  /** 读取服务端最新可恢复会话并同步本地界面，参数 fallback 用于会话刚完成时保留服务返回的最终状态。 */
  async function refreshSession(fallback: RunSession): Promise<void> {
    const refreshed = await service.getResumableSession()
    const next = refreshed ?? fallback
    setDisplayedSession(next)
    onSessionChange?.(next)
  }

  /** 执行完成命令后重新读取会话，当前没有步骤时不执行无效变更。 */
  async function complete(): Promise<void> {
    if (!currentStep) return
    await runCommand(() => service.completeCurrentStep(displayedSession.id))
  }

  /** 执行跳过命令后重新读取会话，当前没有步骤时不执行无效变更。 */
  async function skip(): Promise<void> {
    if (!currentStep) return
    await runCommand(() => service.skipCurrentStep(displayedSession.id))
  }

  /** 执行撤销命令后重新读取会话，参数由当前界面的会话标识隐式提供。 */
  async function undo(): Promise<void> {
    await runCommand(() => service.undoLatestCompletion(displayedSession.id))
  }

  /** 统一处理会话命令及其错误提示，参数 command 负责调用会话服务并返回最新写入结果。 */
  async function runCommand(command: () => Promise<RunSession>): Promise<void> {
    try {
      setError(undefined)
      await refreshSession(await command())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '跑图操作失败。')
    }
  }

  if (!currentStep) return <section aria-label="跑图操作"><h2>路线已完成</h2>{hasCompletedStep && <button type="button" onClick={undo}>撤销完成</button>}</section>

  return <section className="run-mode" aria-label="跑图操作">
    <p>当前步骤</p>
    <h2>{`${displayedSession.currentStepIndex + 1}. ${currentStep.title}`}</h2>
    {currentStep.message && <p>{currentStep.message}</p>}
    <div className="run-mode__actions">
      <button type="button" onClick={complete}>完成此点</button>
      <button type="button" onClick={skip}>跳过此点</button>
      {hasCompletedStep && <button type="button" onClick={undo}>撤销完成</button>}
    </div>
    {currentStep.externalMapUrl && !showExternalMap && <button type="button" onClick={() => setShowExternalMap(true)}>显示官方地图链接</button>}
    {currentStep.externalMapUrl && showExternalMap && <a href={currentStep.externalMapUrl} target="_blank" rel="noreferrer">打开官方地图</a>}
    {error && <p role="alert">{error}</p>}
  </section>
}
