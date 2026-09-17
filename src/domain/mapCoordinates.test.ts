import { expect, it } from 'vitest'
import { toLeafletCoordinate } from './mapCoordinates'

it('将左上原点的领域坐标转换为 Leaflet 坐标', () => {
  expect(toLeafletCoordinate({ x: 240, y: 180 }, { width: 1000, height: 600 }))
    .toEqual([420, 240])
})
