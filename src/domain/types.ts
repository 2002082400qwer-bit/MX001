export type MapCoordinate = { x: number; y: number }

export type MapBounds = { width: number; height: number }

export type RespawnRule =
  | { kind: 'duration'; hours: number }
  | { kind: 'dailyReset'; timeZone: string; hour: number; minute: number }
  | { kind: 'manual'; message: string }

export type RefreshEstimate =
  | { kind: 'known'; availableAt: string; isAvailable: boolean }
  | { kind: 'manual'; message: string }
  | { kind: 'unknown' }

export type ContentManifest = {
  packageId: string
  schemaVersion: number
  contentVersion: string
  gameVersion: string
  createdAt: string
  licenseNotice: string
}

export type Material = {
  id: string
  name: string
  category: string
  respawnRule: RespawnRule
  icon: string
}

export type MapLayer = {
  id: string
  regionId: string
  assetPath: string
  bounds: MapBounds
  externalMapUrl: string
}

export type LocationPoint = {
  id: string
  materialId: string
  mapLayerId: string
  coordinate: MapCoordinate
  yieldRange: { min: number; max: number }
  conditions: string[]
  sourceUrl: string
  sourceKind: 'official' | 'local-demo'
  licenseNotice: string
  verifiedAt: string
  gameVersion: string
  confidence: 'high' | 'medium' | 'low'
}

export type TeleportAnchor = {
  id: string
  mapLayerId: string
  coordinate: MapCoordinate
  name: string
}

export type RouteStep =
  | { id: string; kind: 'teleport'; anchorId: string }
  | { id: string; kind: 'collect'; locationPointId: string }
  | { id: string; kind: 'note'; message: string }

export type RouteTemplate = {
  id: string
  materialIds: string[]
  steps: RouteStep[]
  estimatedMinutes: number
  requirements: string[]
}

export type ContentPackage = {
  manifest: ContentManifest
  materials: Material[]
  mapLayers: MapLayer[]
  locationPoints: LocationPoint[]
  teleportAnchors: TeleportAnchor[]
  routeTemplates: RouteTemplate[]
}

export type ResolvedRouteStep = {
  id: string
  kind: RouteStep['kind']
  title: string
  message?: string
  mapLayerId?: string
  coordinate?: MapCoordinate
  externalMapUrl?: string
  respawnRule?: RespawnRule
  locationPointId?: string
}

export type RoutePlan = {
  id: string
  templateIds: string[]
  estimatedMinutes: number
  steps: ResolvedRouteStep[]
}

export type RoutePlanResult =
  | { kind: 'planned'; plan: RoutePlan }
  | { kind: 'no-route'; reason: 'missing-template' }

export type RunSession = {
  id: string
  routeSnapshot: RoutePlan
  currentStepIndex: number
  stepStates: Array<'pending' | 'completed' | 'skipped'>
  startedAt: string
  updatedAt: string
}

export type CollectionRecord = {
  idempotencyKey: string
  sessionId: string
  routeStepId: string
  locationPointId: string
  materialId: string
  collectedAt: string
  packageId: string
  contentVersion: string
}

export type UserPreference = {
  defaultRegion?: string
  mapZoom?: number
  theme?: 'light' | 'dark' | 'system'
  routePreference?: 'shortest' | 'listed'
}

export type BackupEnvelope = {
  formatVersion: 1
  exportedAt: string
  packageId: string
  contentVersion: string
  sessions: RunSession[]
  collectionRecords: CollectionRecord[]
  preferences: UserPreference
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export type ContentValidationError = {
  code: 'invalid-built-in-content'
  message: string
}
