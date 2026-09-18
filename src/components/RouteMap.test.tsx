import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { MapLayer, RunSession } from '../domain/types'

const { leafletCoordinate } = vi.hoisted(() => ({
  leafletCoordinate: vi.fn((coordinate: { x: number; y: number }) => [600 - coordinate.y, coordinate.x]),
}))

vi.mock('../domain/mapCoordinates', () => ({
  toLeafletCoordinate: leafletCoordinate,
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <section data-testid="leaflet-map">{children}</section>,
  ImageOverlay: () => <div data-testid="grid-image" />,
  Marker: ({ children }: { children: React.ReactNode }) => <div data-testid="map-marker">{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Polyline: () => <div data-testid="route-line" />,
}))

import { RouteMap } from './RouteMap'

const layers: MapLayer[] = [
  { id: 'layer-a', regionId: 'demo', assetPath: '/ignored.svg', bounds: { width: 1000, height: 600 }, externalMapUrl: 'https://act.hoyolab.com/' },
  { id: 'layer-b', regionId: 'demo', assetPath: '/ignored.svg', bounds: { width: 1000, height: 600 }, externalMapUrl: 'https://act.hoyolab.com/' },
]

/** 创建含跨图层步骤的会话，用于验证地图只渲染当前图层。 */
function createSession(): RunSession {
  return {
    id: 'session-1', currentStepIndex: 1, startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    stepStates: ['completed', 'pending', 'pending'],
    routeSnapshot: {
      id: 'route-1', templateIds: [], estimatedMinutes: 1,
      steps: [
        { id: 'first', kind: 'collect', title: '第一点', mapLayerId: 'layer-a', coordinate: { x: 10, y: 20 } },
        { id: 'current', kind: 'teleport', title: '当前点', mapLayerId: 'layer-a', coordinate: { x: 30, y: 40 } },
        { id: 'other-layer', kind: 'collect', title: '另一图层', mapLayerId: 'layer-b', coordinate: { x: 50, y: 60 } },
      ],
    },
  }
}

it('通过坐标适配器显示当前图层并将当前步骤设为独立标记', () => {
  render(<RouteMap session={createSession()} mapLayers={layers} />)

  expect(leafletCoordinate).toHaveBeenCalledWith({ x: 10, y: 20 }, layers[0].bounds)
  expect(leafletCoordinate).toHaveBeenCalledWith({ x: 30, y: 40 }, layers[0].bounds)
  expect(screen.getAllByTestId('map-marker')).toHaveLength(2)
  expect(screen.getByText('当前点（当前步骤）')).toBeInTheDocument()
})

it('不跨图层连线', () => {
  render(<RouteMap session={createSession()} mapLayers={layers} />)

  expect(screen.getAllByTestId('route-line')).toHaveLength(1)
})
