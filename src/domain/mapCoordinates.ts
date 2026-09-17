import type { MapBounds, MapCoordinate } from './types'

/** 将左上原点的领域坐标转换为 Leaflet CRS.Simple 使用的 [y, x] 坐标。 */
export function toLeafletCoordinate(
  coordinate: MapCoordinate,
  bounds: MapBounds,
): [number, number] {
  return [bounds.height - coordinate.y, coordinate.x]
}
