import type {
  ContentPackage,
  LocationPoint,
  MapLayer,
  Material,
  ResolvedRouteStep,
  RoutePlanResult,
  RouteStep,
  RouteTemplate,
  TeleportAnchor,
} from './types'

export type PlanRouteInput = {
  materialIds: string[]
  regionId: string
}

/** 按内容包中的模板顺序，生成指定材料与区域的路线快照；参数 content 为已校验内容包，input 为材料和区域筛选条件。 */
export function planRoute(content: ContentPackage, input: PlanRouteInput): RoutePlanResult {
  const materialIds = new Set(input.materialIds)
  const templatesById = new Set<string>()
  const templateIds: string[] = []
  const steps: ResolvedRouteStep[] = []
  let estimatedMinutes = 0

  for (const template of content.routeTemplates) {
    if (templatesById.has(template.id) || !matchesMaterialSet(template, materialIds)) continue
    const templateSteps = resolveTemplateSteps(content, template, input.regionId)
    if (!templateSteps) continue

    templatesById.add(template.id)
    templateIds.push(template.id)
    estimatedMinutes += template.estimatedMinutes
    steps.push(...templateSteps)
  }

  if (templateIds.length === 0) return { kind: 'no-route', reason: 'missing-template' }

  return {
    kind: 'planned',
    plan: {
      id: `${content.manifest.packageId}:${templateIds.join(',')}`,
      templateIds,
      estimatedMinutes,
      steps,
    },
  }
}

/** 判断模板的全部材料是否都包含在用户选择集合中；参数 template 为候选模板，materialIds 为用户选择材料。 */
function matchesMaterialSet(template: RouteTemplate, materialIds: Set<string>): boolean {
  return template.materialIds.every((materialId) => materialIds.has(materialId))
}

/** 解析同一区域中的模板步骤为独立快照；参数 content 为内容包，template 为候选模板，regionId 为目标区域。 */
function resolveTemplateSteps(
  content: ContentPackage,
  template: RouteTemplate,
  regionId: string,
): ResolvedRouteStep[] | undefined {
  const steps: ResolvedRouteStep[] = []

  for (const step of template.steps) {
    const resolved = resolveStep(content, step, regionId)
    if (!resolved) return undefined
    steps.push(resolved)
  }

  return steps
}

/** 将一个模板步骤解析为完整快照并验证区域；参数 content 为内容包，step 为原始步骤，regionId 为目标区域。 */
function resolveStep(
  content: ContentPackage,
  step: RouteStep,
  regionId: string,
): ResolvedRouteStep | undefined {
  if (step.kind === 'note') return { id: step.id, kind: step.kind, title: step.message, message: step.message }

  if (step.kind === 'teleport') {
    const anchor = content.teleportAnchors.find((candidate) => candidate.id === step.anchorId)
    if (!anchor) return undefined
    const layer = content.mapLayers.find((candidate) => candidate.id === anchor.mapLayerId)
    if (!layer || layer.regionId !== regionId) return undefined
    return snapshotAnchorStep(step, anchor, layer)
  }

  const point = content.locationPoints.find((candidate) => candidate.id === step.locationPointId)
  if (!point) return undefined
  const material = content.materials.find((candidate) => candidate.id === point.materialId)
  const layer = content.mapLayers.find((candidate) => candidate.id === point.mapLayerId)
  if (!material || !layer || layer.regionId !== regionId) return undefined
  return snapshotCollectStep(step, point, material, layer)
}

/** 复制传送锚点的可恢复信息；参数 step 为模板步骤，anchor 为锚点，layer 为所属图层。 */
function snapshotAnchorStep(step: Extract<RouteStep, { kind: 'teleport' }>, anchor: TeleportAnchor, layer: MapLayer): ResolvedRouteStep {
  return {
    id: step.id,
    kind: step.kind,
    title: anchor.name,
    anchorId: anchor.id,
    mapLayerId: layer.id,
    coordinate: { ...anchor.coordinate },
    externalMapUrl: layer.externalMapUrl,
  }
}

/** 复制采集点与材料的可恢复信息；参数 step 为模板步骤，point 为点位，material 为材料，layer 为所属图层。 */
function snapshotCollectStep(
  step: Extract<RouteStep, { kind: 'collect' }>,
  point: LocationPoint,
  material: Material,
  layer: MapLayer,
): ResolvedRouteStep {
  return {
    id: step.id,
    kind: step.kind,
    title: material.name,
    message: point.conditions.join('；'),
    locationPointId: point.id,
    materialId: material.id,
    mapLayerId: layer.id,
    coordinate: { ...point.coordinate },
    externalMapUrl: layer.externalMapUrl,
    sourceUrl: point.sourceUrl,
    conditions: [...point.conditions],
    respawnRule: cloneRespawnRule(material.respawnRule),
  }
}

/** 深复制刷新规则以隔离路线快照；参数 rule 为内容包中的材料刷新规则。 */
function cloneRespawnRule(rule: Material['respawnRule']): Material['respawnRule'] {
  return { ...rule }
}
