import { z } from 'zod'
import type { ContentPackage } from './types'

const nonEmptyStringSchema = z.string().trim().min(1)

const mapCoordinateSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
}).strict()

const mapBoundsSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
}).strict()

export const respawnRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('duration'), hours: z.number().int().positive() }).strict(),
  z.object({
    kind: z.literal('dailyReset'),
    timeZone: nonEmptyStringSchema,
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
  }).strict(),
  z.object({ kind: z.literal('manual'), message: nonEmptyStringSchema }).strict(),
])

const httpsUrlSchema = z.url().refine(
  /** 校验来源链接使用 HTTPS 协议，参数 value 为待校验的 URL 字符串。 */
  (value) => new URL(value).protocol === 'https:',
  '链接必须使用 HTTPS 协议',
)

const hoyolabUrlSchema = httpsUrlSchema.refine(
  /** 校验地图外链为无端口和凭据的 HoYoLAB HTTPS 链接，参数 value 为待校验的 URL 字符串。 */
  (value) => {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'act.hoyolab.com'
      && url.port === ''
      && url.username === ''
      && url.password === ''
  },
  '地图外链必须是不含端口和凭据的 act.hoyolab.com HTTPS 链接',
)

const routeStepSchema = z.discriminatedUnion('kind', [
  z.object({ id: nonEmptyStringSchema, kind: z.literal('teleport'), anchorId: nonEmptyStringSchema }).strict(),
  z.object({ id: nonEmptyStringSchema, kind: z.literal('collect'), locationPointId: nonEmptyStringSchema }).strict(),
  z.object({ id: nonEmptyStringSchema, kind: z.literal('note'), message: nonEmptyStringSchema }).strict(),
])

const contentPackageBaseSchema = z.object({
  manifest: z.object({
    packageId: nonEmptyStringSchema,
    schemaVersion: z.number().int().positive(),
    contentVersion: nonEmptyStringSchema,
    gameVersion: nonEmptyStringSchema,
    createdAt: z.string().datetime({ offset: true }),
    licenseNotice: nonEmptyStringSchema,
  }).strict(),
  materials: z.array(z.object({
    id: nonEmptyStringSchema,
    name: nonEmptyStringSchema,
    category: nonEmptyStringSchema,
    respawnRule: respawnRuleSchema,
    icon: nonEmptyStringSchema,
  }).strict()).min(1),
  mapLayers: z.array(z.object({
    id: nonEmptyStringSchema,
    regionId: nonEmptyStringSchema,
    assetPath: nonEmptyStringSchema,
    bounds: mapBoundsSchema,
    externalMapUrl: hoyolabUrlSchema,
  }).strict()).min(1),
  locationPoints: z.array(z.object({
    id: nonEmptyStringSchema,
    materialId: nonEmptyStringSchema,
    mapLayerId: nonEmptyStringSchema,
    coordinate: mapCoordinateSchema,
    yieldRange: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).strict(),
    conditions: z.array(nonEmptyStringSchema),
    sourceUrl: httpsUrlSchema,
    sourceKind: z.enum(['official', 'local-demo']),
    licenseNotice: nonEmptyStringSchema,
    verifiedAt: z.string().datetime({ offset: true }),
    gameVersion: nonEmptyStringSchema,
    confidence: z.enum(['high', 'medium', 'low']),
  }).strict()).min(1),
  teleportAnchors: z.array(z.object({
    id: nonEmptyStringSchema,
    mapLayerId: nonEmptyStringSchema,
    coordinate: mapCoordinateSchema,
    name: nonEmptyStringSchema,
  }).strict()).min(1),
  routeTemplates: z.array(z.object({
    id: nonEmptyStringSchema,
    materialIds: z.array(nonEmptyStringSchema).min(1),
    steps: z.array(routeStepSchema).min(1),
    estimatedMinutes: z.number().int().positive(),
    requirements: z.array(nonEmptyStringSchema),
  }).strict()).min(1),
}).strict()

export const contentPackageSchema = contentPackageBaseSchema.superRefine(
  /** 校验点位关联的图层、材料及坐标边界，参数 content 为已完成基础结构校验的内容包。 */
  (content, context) => {
    const layersById = new Map(content.mapLayers.map((layer) => [layer.id, layer]))
    const materialIds = new Set(content.materials.map((material) => material.id))

    content.locationPoints.forEach((point, index) => {
      const layer = layersById.get(point.mapLayerId)
      if (!layer) {
        context.addIssue({ code: 'custom', path: ['locationPoints', index, 'mapLayerId'], message: '点位引用了不存在的图层' })
        return
      }
      if (!materialIds.has(point.materialId)) {
        context.addIssue({ code: 'custom', path: ['locationPoints', index, 'materialId'], message: '点位引用了不存在的材料' })
      }
      if (point.coordinate.x < 0 || point.coordinate.x > layer.bounds.width || point.coordinate.y < 0 || point.coordinate.y > layer.bounds.height) {
        context.addIssue({ code: 'custom', path: ['locationPoints', index, 'coordinate'], message: '点位坐标超出图层边界' })
      }
      if (point.yieldRange.min > point.yieldRange.max) {
        context.addIssue({ code: 'custom', path: ['locationPoints', index, 'yieldRange'], message: '产量范围下限不能大于上限' })
      }
    })

    content.teleportAnchors.forEach((anchor, index) => {
      const layer = layersById.get(anchor.mapLayerId)
      if (!layer || anchor.coordinate.x < 0 || anchor.coordinate.x > layer.bounds.width || anchor.coordinate.y < 0 || anchor.coordinate.y > layer.bounds.height) {
        context.addIssue({ code: 'custom', path: ['teleportAnchors', index], message: '传送点必须位于存在图层的边界内' })
      }
    })
  },
)

const resolvedRouteStepSchema = z.object({
  id: nonEmptyStringSchema,
  kind: z.enum(['teleport', 'collect', 'note']),
  title: nonEmptyStringSchema,
  message: nonEmptyStringSchema.optional(),
  mapLayerId: nonEmptyStringSchema.optional(),
  coordinate: mapCoordinateSchema.optional(),
  externalMapUrl: hoyolabUrlSchema.optional(),
  respawnRule: respawnRuleSchema.optional(),
  locationPointId: nonEmptyStringSchema.optional(),
  anchorId: nonEmptyStringSchema.optional(),
  materialId: nonEmptyStringSchema.optional(),
  sourceUrl: httpsUrlSchema.optional(),
  conditions: z.array(nonEmptyStringSchema).optional(),
}).strict()

const routePlanSchema = z.object({
  id: nonEmptyStringSchema,
  templateIds: z.array(nonEmptyStringSchema),
  estimatedMinutes: z.number().int().nonnegative(),
  steps: z.array(resolvedRouteStepSchema),
}).strict()

const runSessionSchema = z.object({
  id: nonEmptyStringSchema,
  routeSnapshot: routePlanSchema,
  currentStepIndex: z.number().int().nonnegative(),
  stepStates: z.array(z.enum(['pending', 'completed', 'skipped'])),
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

const collectionRecordSchema = z.object({
  idempotencyKey: nonEmptyStringSchema,
  sessionId: nonEmptyStringSchema,
  routeStepId: nonEmptyStringSchema,
  locationPointId: nonEmptyStringSchema,
  materialId: nonEmptyStringSchema,
  collectedAt: z.string().datetime({ offset: true }),
  packageId: nonEmptyStringSchema,
  contentVersion: nonEmptyStringSchema,
}).strict()

export const backupEnvelopeSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string().datetime({ offset: true }),
  packageId: nonEmptyStringSchema,
  contentVersion: nonEmptyStringSchema,
  sessions: z.array(runSessionSchema),
  collectionRecords: z.array(collectionRecordSchema),
  preferences: z.object({
    defaultRegion: nonEmptyStringSchema.optional(),
    mapZoom: z.number().finite().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    routePreference: z.enum(['shortest', 'listed']).optional(),
  }).strict(),
}).strict()

/** 将已经通过内容 Schema 的值标注为领域内容包类型，参数 value 为 Schema 解析结果。 */
export function asContentPackage(value: z.output<typeof contentPackageSchema>): ContentPackage {
  return value
}
