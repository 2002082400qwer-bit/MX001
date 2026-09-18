import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

/**
 * 创建一组用于安全校验命令的 Tauri 配置文件。
 * @param config Tauri 主配置对象。
 * @param capability Tauri capability 配置对象。
 * @returns 主配置与 capability 文件的绝对路径。
 */
function createSecurityFixture(config: object, capability: object): { configPath: string; capabilityPath: string } {
  const directory = mkdtempSync(join(tmpdir(), 'genshin-tauri-security-'))
  temporaryDirectories.push(directory)
  const configPath = join(directory, 'tauri.conf.json')
  const capabilityPath = join(directory, 'default.json')
  writeFileSync(configPath, JSON.stringify(config), 'utf8')
  writeFileSync(capabilityPath, JSON.stringify(capability), 'utf8')
  return { configPath, capabilityPath }
}

/** 清理测试中创建的临时配置目录，避免污染系统临时目录。 */
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('verify-tauri-security', () => {
  it('拒绝关闭 CSP 或授予危险插件权限的 Tauri 配置', () => {
    const fixture = createSecurityFixture(
      {
        app: {
          security: {
            csp: "default-src 'self'; img-src 'self' data:",
            dangerousDisableAssetCspModification: true,
          },
        },
      },
      { permissions: ['core:default', 'shell:allow-open'] },
    )

    expect(() =>
      execFileSync(
        process.execPath,
        ['scripts/verify-tauri-security.mjs', fixture.configPath, fixture.capabilityPath],
        { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' },
      ),
    ).toThrow(/CSP|权限/)
  })
})
