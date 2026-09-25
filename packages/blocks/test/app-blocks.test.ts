import { describe, expect, it } from 'vitest'
import { type AppBlockSource, buildAppBlocks } from '../src/app-blocks'

const block = (type: string) => ({
  type,
  label: type,
  fields: {},
  defaultProps: { foo: 'bar' },
  render: () => null,
})

const source = (id: string, name: string, types: string[]): AppBlockSource => ({
  id,
  name,
  icon: 'Bell',
  blocks: types.map((t) => block(t)),
})

describe('buildAppBlocks', () => {
  it('returns nothing for no sources', () => {
    expect(buildAppBlocks([], new Set())).toEqual({
      categoryComponents: [],
      components: {},
      owners: {},
    })
  })

  it('lists an enabled source’s blocks in the Add panel and owns them', () => {
    const back = source('back-in-stock', 'Back in stock', ['back-in-stock/NotifyMe'])
    const built = buildAppBlocks([back], new Set(['back-in-stock']))

    expect(built.categoryComponents).toEqual(['back-in-stock/NotifyMe'])
    expect(built.owners).toEqual({
      'back-in-stock/NotifyMe': { appName: 'Back in stock', appIcon: 'Bell' },
    })
    expect(built.components['back-in-stock/NotifyMe']?.label).toBe('back-in-stock/NotifyMe')
    expect(built.components['back-in-stock/NotifyMe']?.defaultProps).toEqual({ foo: 'bar' })
  })

  it('keeps a disabled source’s block out of the Add panel but still renders a placeholder', () => {
    const back = source('back-in-stock', 'Back in stock', ['back-in-stock/NotifyMe'])
    const built = buildAppBlocks([back], new Set())

    expect(built.categoryComponents).toEqual([])
    expect(built.owners).toEqual({})
    // A saved page that already placed the block must still find a component for it.
    expect(built.components['back-in-stock/NotifyMe']).toBeDefined()
    expect(built.components['back-in-stock/NotifyMe']?.render).not.toBe(back.blocks?.[0]?.render)
  })

  it('enforces <sourceId>/<Name> namespacing', () => {
    const bad = source('back-in-stock', 'Back in stock', ['wrong-namespace/NotifyMe'])
    expect(() => buildAppBlocks([bad], new Set(['back-in-stock']))).toThrow(/namespaced/)
  })

  it('rejects two sources declaring the same block type', () => {
    const a = source('delhivery', 'Delhivery', ['delhivery/DeliveryChecker'])
    const b: AppBlockSource = {
      id: 'delhivery',
      name: 'Delhivery Duplicate',
      blocks: [block('delhivery/DeliveryChecker')],
    }
    expect(() => buildAppBlocks([a, b], new Set(['delhivery']))).toThrow(/declared by both/)
  })

  it('lets two different enabled apps each register their own namespaced block', () => {
    const delhivery = source('delhivery', 'Delhivery', ['delhivery/DeliveryChecker'])
    const shiprocket = source('shiprocket', 'Shiprocket', ['shiprocket/DeliveryChecker'])
    const built = buildAppBlocks([delhivery, shiprocket], new Set(['delhivery', 'shiprocket']))

    expect(built.categoryComponents.sort()).toEqual([
      'delhivery/DeliveryChecker',
      'shiprocket/DeliveryChecker',
    ])
  })
})
