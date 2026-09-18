import { readFileSync } from 'node:fs'

const defaultConfigPath = 'src-tauri/tauri.conf.json'
const defaultCapabilityPath = 'src-tauri/capabilities/default.json'
const forbiddenPermissionPrefixes = ['shell:', 'fs:', 'http:', 'global-shortcut:', 'plugin:']

/**
 * 读取并解析 UTF-8 JSON 配置文件。
 * @param filePath 待读取配置文件的路径。
 * @returns 已解析的 JSON 对象。
 */
function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

/**
 * 确认生产 CSP 仅允许应用自身与 data 图片，且没有远程网络来源。
 * @param config Tauri 主配置对象。
 */
function verifyProductionCsp(config) {
  const serializedConfig = JSON.stringify(config)
  const csp = config.app?.security?.csp
  if (serializedConfig.includes('dangerousDisableAssetCspModification')) {
    throw new Error('Tauri 配置包含危险的 CSP 关闭开关')
  }
  if (typeof csp !== 'string' || !csp.includes("default-src 'self'")) {
    throw new Error('生产 CSP 缺少 default-src self 限制')
  }
  if (!csp.includes("img-src 'self' data:")) {
    throw new Error('生产 CSP 必须仅将 data: 作为图片额外来源')
  }
  if (/\bhttps?:|\bws:|\bwss:/.test(csp)) {
    throw new Error('生产 CSP 不得包含远程网络来源')
  }
}

/**
 * 确认 capability 仅保留 Tauri 核心默认权限，未授予插件或敏感系统访问能力。
 * @param capability Tauri capability 配置对象。
 */
function verifyCapability(capability) {
  const permissions = capability.permissions
  if (!Array.isArray(permissions) || permissions.length !== 1 || permissions[0] !== 'core:default') {
    throw new Error('Tauri capability 必须且只能包含 core:default 权限')
  }
  if (permissions.some((permission) => forbiddenPermissionPrefixes.some((prefix) => permission.startsWith(prefix)))) {
    throw new Error('Tauri capability 包含禁止的插件或系统权限')
  }
}

/**
 * 校验 Tauri 主配置和 capability 是否保持最小权限与生产 CSP 限制。
 * @param configPath Tauri 主配置文件路径。
 * @param capabilityPath Tauri capability 文件路径。
 */
function verifyTauriSecurity(configPath, capabilityPath) {
  verifyProductionCsp(readJson(configPath))
  verifyCapability(readJson(capabilityPath))
}

const [configPath = defaultConfigPath, capabilityPath = defaultCapabilityPath] = process.argv.slice(2)

try {
  verifyTauriSecurity(configPath, capabilityPath)
  console.log('Tauri 安全配置校验通过。')
} catch (error) {
  console.error(`Tauri 安全配置校验失败：${error.message}`)
  process.exitCode = 1
}
