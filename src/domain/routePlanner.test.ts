import demoContent from '../content/demo-content.json'
import { describe, expect, it } from 'vitest'
import { contentPackageSchema } from './schemas'
import { planRoute } from './routePlanner'

const content = contentPackageSchema.parse(demoContent)

describe('planRoute', () => {
  it('按区域拼接匹配材料的人工路线并保留步骤快照', () => {
    const result = planRoute(content, { materialIds: ['mint', 'mushroom'], regionId: 'demo-region' })

    expect(result.kind).toBe('planned')
    if (result.kind !== 'planned') throw new Error('路线应当存在')

    expect(result.plan.templateIds).toEqual(['mint-route-1', 'mushroom-route-1'])
    expect(result.plan.estimatedMinutes).toBe(9)
    expect(result.plan.steps).toHaveLength(6)
    expect(result.plan.steps.find((step) => step.kind === 'collect')).toMatchObject({
      title: '薄荷',
      coordinate: { x: 160, y: 120 },
      mapLayerId: 'demo-grid',
      externalMapUrl: 'https://act.hoyolab.com/',
      locationPointId: 'mint-1',
      respawnRule: { kind: 'duration', hours: 48 },
    })
    expect(result.plan.steps.find((step) => step.kind === 'teleport')).toMatchObject({
      title: '薄荷路线起点',
      coordinate: { x: 80, y: 80 },
      mapLayerId: 'demo-grid',
      externalMapUrl: 'https://act.hoyolab.com/',
    })
  })

  it('保留内容包模板顺序并去重重复模板 ID', () => {
    const contentWithDuplicate = {
      ...content,
      routeTemplates: [content.routeTemplates[1], content.routeTemplates[0], content.routeTemplates[0]],
    }

    const result = planRoute(contentWithDuplicate, { materialIds: ['mint', 'mushroom'], regionId: 'demo-region' })

    expect(result.kind).toBe('planned')
    if (result.kind !== 'planned') throw new Error('路线应当存在')
    expect(result.plan.templateIds).toEqual(['mushroom-route-1', 'mint-route-1'])
  })

  it('没有同时匹配材料和区域的模板时不猜测路线', () => {
    expect(planRoute(content, { materialIds: ['mint'], regionId: 'other-region' }))
      .toEqual({ kind: 'no-route', reason: 'missing-template' })
  })
})
