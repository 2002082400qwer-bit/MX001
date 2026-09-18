import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'

const defaultConfigPath = 'src-tauri/tauri.conf.json'
const defaultCapabilityLocation = 'src-tauri/capabilities'
const requiredDevUrl = 'http://localhost:5173'
const allowedCspDirectives = new Map([
  ['default-src', ["'self'"]],
  ['img-src', ["'self'", 'data:']],
  ['connect-src', ["'self'"]],
  ['script-src', ["'self'"]],
  ['style-src', ["'self'"]],
  ['object-src', ["'none'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
])
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
 * 将 CSP 字符串解析为指令名到来源令牌列表的映射。
 * @param csp 待解析的 CSP 字符串。
 * @returns CSP 指令及其来源令牌映射。
 */
function parseCsp(csp) {
  if (typeof csp !== 'string') {
    throw new Error('生产 CSP 必须为字符串')
  }

  const directives = new Map()
  for (const segment of csp.split(';')) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const [name, ...sources] = tokens
    if (directives.has(name) || sources.length === 0) {
      throw new Error('生产 CSP 包含重复或无来源的指令')
    }
    directives.set(name, sources)
  }
  return directives
}

/**
 * 比较两个来源令牌列表，忽略书写顺序但拒绝重复、缺失和额外来源。
 * @param actual 实际来源令牌列表。
 * @param expected 白名单来源令牌列表。
 * @returns 两个列表是否精确匹配。
 */
function hasExactTokens(actual, expected) {
  return actual.length === expected.length && new Set(actual).size === actual.length && actual.every((token) => expected.includes(token))
}

/**
 * 确认生产 CSP 仅使用精确的本地来源白名单，拒绝通配符、协议、主机和 unsafe 扩展。
 * @param config Tauri 主配置对象。
 */
function verifyProductionCsp(config) {
  if (config.app?.security?.dangerousDisableAssetCspModification === true) {
    throw new Error('Tauri 配置包含危险的 CSP 关闭开关')
  }

  const directives = parseCsp(config.app?.security?.csp)
  if (directives.size !== allowedCspDirectives.size) {
    throw new Error('生产 CSP 包含未授权或缺失的指令')
  }
  for (const [name, expectedSources] of allowedCspDirectives) {
    const actualSources = directives.get(name)
    if (!actualSources || !hasExactTokens(actualSources, expectedSources)) {
      throw new Error(`生产 CSP 指令 ${name} 不符合最小来源白名单`)
    }
  }
}

/**
 * 确认开发服务器 URL 完全匹配项目指定的本地 Vite 地址。
 * @param config Tauri 主配置对象。
 */
function verifyDevUrl(config) {
  if (config.build?.devUrl !== requiredDevUrl) {
    throw new Error(`build.devUrl 必须为 ${requiredDevUrl}`)
  }
}

/**
 * 确认 app.capabilities 显式且只引用默认 capability，避免隐式载入额外文件或内联权限。
 * @param config Tauri 主配置对象。
 */
function verifyConfiguredCapabilities(config) {
  const capabilities = config.app?.capabilities
  if (!Array.isArray(capabilities) || capabilities.length !== 1 || capabilities[0] !== 'default') {
    throw new Error('app.capabilities 必须且只能引用 default capability')
  }
}

/**
 * 收集单个 capability 文件或目录下全部 JSON capability 文件。
 * @param capabilityLocation capability 文件或目录路径。
 * @returns capability JSON 文件路径列表。
 */
function collectCapabilityFiles(capabilityLocation) {
  if (!statSync(capabilityLocation).isDirectory()) {
    return [capabilityLocation]
  }
  return readdirSync(capabilityLocation, { withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === '.json')
    .map((entry) => join(capabilityLocation, entry.name))
}

/**
 * 确认单个 capability 仅保留核心默认权限，未授予插件或敏感系统访问能力。
 * @param capability Tauri capability 配置对象。
 * @param filePath capability 文件路径，用于生成明确错误信息。
 */
function verifyCapability(capability, filePath) {
  const permissions = capability.permissions
  if (capability.identifier !== undefined && capability.identifier !== 'default') {
    throw new Error(`额外 capability 文件不被允许：${filePath}`)
  }
  if (!Array.isArray(permissions) || permissions.length !== 1 || permissions[0] !== 'core:default') {
    throw new Error(`Tauri capability 必须且只能包含 core:default 权限：${filePath}`)
  }
  if (permissions.some((permission) => typeof permission !== 'string' || forbiddenPermissionPrefixes.some((prefix) => permission.startsWith(prefix)))) {
    throw new Error(`Tauri capability 包含禁止的插件或系统权限：${filePath}`)
  }
}

/**
 * 校验 Tauri 主配置和所有 capability 文件是否保持最小权限与生产 CSP 限制。
 * @param configPath Tauri 主配置文件路径。
 * @param capabilityLocation capability 文件或目录路径。
 */
function verifyTauriSecurity(configPath, capabilityLocation) {
  const config = readJson(configPath)
  verifyDevUrl(config)
  verifyProductionCsp(config)
  verifyConfiguredCapabilities(config)

  const capabilityFiles = collectCapabilityFiles(capabilityLocation)
  if (capabilityFiles.length !== 1) {
    throw new Error('capability 目录必须且只能包含 default.json')
  }
  for (const filePath of capabilityFiles) {
    verifyCapability(readJson(filePath), filePath)
  }
}

const [configPath = defaultConfigPath, capabilityLocation = defaultCapabilityLocation] = process.argv.slice(2)

try {
  verifyTauriSecurity(configPath, capabilityLocation)
  console.log('Tauri 安全配置校验通过。')
} catch (error) {
  console.error(`Tauri 安全配置校验失败：${error.message}`)
  process.exitCode = 1
}
