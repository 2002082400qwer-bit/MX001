import { CRS } from 'leaflet'
import { ImageOverlay, MapContainer, Marker, Polyline, Popup } from 'react-leaflet'
import routeGridUrl from '../content/route-grid.svg'
import { toLeafletCoordinate } from '../domain/mapCoordinates'
import type { MapLayer, ResolvedRouteStep, RunSession } from '../domain/types'

type RouteMapProps = {
  session: RunSession
  mapLayers: MapLayer[]
}

type PositionedStep = {
  step: ResolvedRouteStep
  position: [number, number]
  isCurrent: boolean
}

/** 以 Leaflet CRS.Simple 呈现当前步骤所在图层，参数 session 提供路线快照，mapLayers 提供图层边界。 */
export function RouteMap({ session, mapLayers }: RouteMapProps) {
  const currentStep = session.routeSnapshot.steps[session.currentStepIndex]
  const layer = mapLayers.find((item) => item.id === currentStep?.mapLayerId)

  if (!currentStep || !layer) return <p role="status">当前步骤没有可显示的地图图层。</p>

  const positionedSteps = getPositionedSteps(session, layer)
  const lines = getAdjacentLines(session, layer)
  const bounds: [[number, number], [number, number]] = [[0, 0], [layer.bounds.height, layer.bounds.width]]

  return <section className="route-map" aria-label="路线地图">
    <MapContainer crs={CRS.Simple} bounds={bounds} className="route-map__canvas">
      <ImageOverlay url={routeGridUrl} bounds={bounds} />
      {lines.map((positions, index) => <Polyline key={`line-${index}`} positions={positions} />)}
      {positionedSteps.map(({ step, position, isCurrent }) => (
        <Marker key={step.id} position={position} opacity={isCurrent ? 1 : 0.65}>
          <Popup>{isCurrent ? `${step.title}（当前步骤）` : step.title}</Popup>
        </Marker>
      ))}
    </MapContainer>
  </section>
}

/** 将当前图层内带坐标的路线步骤转为 Leaflet 坐标，参数 session 与 layer 分别提供路线和图层边界。 */
function getPositionedSteps(session: RunSession, layer: MapLayer): PositionedStep[] {
  return session.routeSnapshot.steps.flatMap((step, index) => {
    if (step.mapLayerId !== layer.id || !step.coordinate) return []
    return [{ step, position: toLeafletCoordinate(step.coordinate, layer.bounds), isCurrent: index === session.currentStepIndex }]
  })
}

/** 生成仅限同图层且在路线中相邻的采集/传送连线，参数 session 与 layer 分别提供路线和当前图层。 */
function getAdjacentLines(session: RunSession, layer: MapLayer): Array<[[number, number], [number, number]]> {
  const lines: Array<[[number, number], [number, number]]> = []
  for (let index = 1; index < session.routeSnapshot.steps.length; index += 1) {
    const previous = session.routeSnapshot.steps[index - 1]
    const current = session.routeSnapshot.steps[index]
    if (!canConnect(previous, current, layer.id)) continue
    if (!previous.coordinate || !current.coordinate) continue
    lines.push([
      toLeafletCoordinate(previous.coordinate, layer.bounds),
      toLeafletCoordinate(current.coordinate, layer.bounds),
    ])
  }
  return lines
}

/** 判断两个相邻步骤能否绘制连线，参数 previous/current 是相邻步骤，layerId 是当前图层标识。 */
function canConnect(previous: ResolvedRouteStep, current: ResolvedRouteStep, layerId: string): boolean {
  const allowedKinds = new Set(['collect', 'teleport'])
  return allowedKinds.has(previous.kind)
    && allowedKinds.has(current.kind)
    && previous.mapLayerId === layerId
    && current.mapLayerId === layerId
    && Boolean(previous.coordinate)
    && Boolean(current.coordinate)
}
