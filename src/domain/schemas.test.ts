import { expect, it } from 'vitest'
import { contentPackageSchema } from './schemas'
import validContent from '../content/demo-content.json'

it('拒绝非 HoYoLAB 外链', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://example.com'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝 HoYoLAB 的非默认端口外链', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://act.hoyolab.com:444/route?area=demo#step'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝 HoYoLAB 外链中的用户名或密码', () => {
  const invalid = structuredClone(validContent)
  invalid.mapLayers[0].externalMapUrl = 'https://user:password@act.hoyolab.com/route?area=demo#step'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('接受合成的有效演示内容', () => {
  expect(contentPackageSchema.parse(validContent).materials).toHaveLength(2)
})

it('拒绝超出所属图层边界的点位', () => {
  const invalid = structuredClone(validContent)
  invalid.locationPoints[0].coordinate.x = 1001
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})

it('拒绝非 HTTPS 的来源链接', () => {
  const invalid = structuredClone(validContent)
  invalid.locationPoints[0].sourceUrl = 'http://act.hoyolab.com/'
  expect(() => contentPackageSchema.parse(invalid)).toThrow()
})
