import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

/**
 * 创建一组用于安全校验命令的 Tauri 配置文件。
 * @param config Tauri 主配置对象。
 * @param capabilities 以标识符为键的 capability 配置对象。
 * @returns 主配置、默认 capability 文件与 capability 目录的绝对路径。
 */
function createSecurityFixture(config: object, capabilities: Record<string, object> = { default: { permissions: ['core:default'] } }) {
  const directory = mkdtempSync(join(tmpdir(), 'genshin-tauri-security-'))
  temporaryDirectories.push(directory)
  const configPath = join(directory, 'tauri.conf.json')
  const capabilityDirectory = join(directory, 'capabilities')
  const capabilityPath = join(capabilityDirectory, 'default.json')
  mkdirSync(capabilityDirectory)
  writeFileSync(configPath, JSON.stringify(config), 'utf8')
  for (const [identifier, capability] of Object.entries(capabilities)) {
    writeFileSync(join(capabilityDirectory, `${identifier}.json`), JSON.stringify(capability), 'utf8')
  }
  return { configPath, capabilityDirectory, capabilityPath }
}

/**
 * 构造符合最小权限与生产 CSP 要求的 Tauri 主配置。
 * @param overrides 要覆盖的主配置字段。
 * @returns 可作为安全测试基线的 Tauri 配置对象。
 */
function createSafeConfig(overrides: object = {}): object {
  return {
    build: { devUrl: 'http://localhost:5173' },
    app: {
      capabilities: ['default'],
      security: {
        csp: "default-src 'self'; img-src 'self' data:; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
      },
    },
    ...overrides,
  }
}

/**
 * 执行 Tauri 安全校验脚本并返回命令输出。
 * @param configPath Tauri 主配置文件路径。
 * @param capabilityLocation capability 文件或目录路径。
 * @returns 安全校验脚本的标准输出文本。
 */
function runVerifier(configPath: string, capabilityLocation: string): string {
  return execFileSync(process.execPath, ['scripts/verify-tauri-security.mjs', configPath, capabilityLocation], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

/** 清理测试中创建的临时配置目录，避免污染系统临时目录。 */
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe('verify-tauri-security', () => {
  it('拒绝关闭 CSP 的危险配置', () => {
    const fixture = createSecurityFixture(createSafeConfig({ app: { capabilities: ['default'], security: { csp: "default-src 'self'; img-src 'self' data:", dangerousDisableAssetCspModification: true } } }))
    expect(() => runVerifier(fixture.configPath, fixture.capabilityPath)).toThrow(/CSP/)
  })

  it('拒绝单独出现的 Shell 权限', () => {
    const fixture = createSecurityFixture(createSafeConfig(), { default: { permissions: ['core:default', 'shell:allow-open'] } })
    expect(() => runVerifier(fixture.configPath, fixture.capabilityPath)).toThrow(/权限/)
  })

  it('拒绝非指定的 Vite 开发 URL', () => {
    const fixture = createSecurityFixture(createSafeConfig({ build: { devUrl: 'http://localhost:4173' } }))
    expect(() => runVerifier(fixture.configPath, fixture.capabilityPath)).toThrow(/devUrl/)
  })

  it('拒绝生产 CSP 中的 unsafe-inline token', () => {
    const fixture = createSecurityFixture(createSafeConfig({ app: { capabilities: ['default'], security: { csp: "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'" } } }))
    expect(() => runVerifier(fixture.configPath, fixture.capabilityPath)).toThrow(/CSP/)
  })

  it('拒绝 app.capabilities 中的额外 capability', () => {
    const fixture = createSecurityFixture(createSafeConfig({ app: { capabilities: ['default', 'extra'], security: { csp: "default-src 'self'; img-src 'self' data:; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'" } } }))
    expect(() => runVerifier(fixture.configPath, fixture.capabilityPath)).toThrow(/capability/)
  })

  it('枚举 capability 目录中所有文件并拒绝额外权限', () => {
    const fixture = createSecurityFixture(createSafeConfig(), { default: { permissions: ['core:default'] }, extra: { permissions: ['shell:allow-open'] } })
    expect(() => runVerifier(fixture.configPath, fixture.capabilityDirectory)).toThrow(/capability/)
  })
})
