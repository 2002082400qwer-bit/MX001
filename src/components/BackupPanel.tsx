import { useEffect, useRef, useState } from 'react'

import { BackupError, exportBackup, importBackup } from '../infrastructure/backupService'

/** 渲染本地数据备份导入和导出的可访问界面，仅使用浏览器 File 与 Blob API。 */
export function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [downloadUrl, setDownloadUrl] = useState<string>()
  const [message, setMessage] = useState('')

  /** 在组件卸载时释放临时下载链接，参数无需由调用方提供。 */
  useEffect(() => () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl)
  }, [downloadUrl])

  /** 生成 Blob 临时下载链接并更新成功提示，参数为按钮点击事件。 */
  async function handleExport(): Promise<void> {
    try {
      const backup = await exportBackup()
      setDownloadUrl(URL.createObjectURL(backup))
      setMessage('备份已生成，请下载备份文件。')
    } catch {
      setMessage('无法生成备份，请稍后重试。')
    }
  }

  /** 导入用户选择的备份文件并把成功、冲突或错误结果显示给用户，参数为文件输入事件。 */
  async function handleImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const report = await importBackup(file)
      const conflictMessage = report.conflictedSessionIds.length > 0
        ? `，保留了 ${report.conflictedSessionIds.length} 个本机会话冲突`
        : ''
      setMessage(`导入成功：新增 ${report.importedSessionCount} 个会话、${report.importedRecordCount} 条采集记录${conflictMessage}。`)
    } catch (error) {
      setMessage(getImportErrorMessage(error))
    }
  }

  return (
    <section aria-label="本地备份">
      <h2>本地备份</h2>
      <input
        ref={fileInputRef}
        aria-label="选择备份文件"
        accept="application/json,.json"
        type="file"
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        onChange={handleImport}
      />
      <button type="button" onClick={() => fileInputRef.current?.click()}>导入备份</button>
      <button type="button" onClick={handleExport}>导出备份</button>
      {downloadUrl && <a href={downloadUrl} download="genshin-material-runner-backup.json">下载备份文件</a>}
      {message && <p role="status">{message}</p>}
    </section>
  )
}

/** 将服务层稳定错误代码转换为中文可理解提示，参数 error 为导入期间捕获的异常。 */
function getImportErrorMessage(error: unknown): string {
  if (error instanceof BackupError) {
    if (error.code === 'backup-too-large') return '备份文件不能超过 5 MiB。'
    if (error.code === 'unsupported-backup-version') return '该备份版本不受支持。'
  }
  return '备份文件无效或已损坏。'
}
