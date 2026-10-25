/** SOURCE OF TRUTH: order routing tests — WHAT: pure `routeOrder` cases / WHY: guards which location ships each line */
import { describe, expect, it } from 'vitest'
import { type RoutingLine, type RoutingLocation, routeOrder } from './routing'

/** Warehouses as Waimers has them: Haryana (default), Delhi, Mumbai. */
function at(
  id: string,
  stock: Record<string, number>,
  extra: Partial<Omit<RoutingLocation, 'id' | 'available'>> = {},
): RoutingLocation {
  const states: Record<string, string> = { haryana: 'HR', delhi: 'DL', mumbai: 'MH' }
  return {
    id,
    stateCode: states[id] ?? null,
    gstStateCode: states[id] ?? null,
    priority: { haryana: 0, delhi: 1, mumbai: 2 }[id] ?? 9,
    isDefault: id === 'haryana',
    composition: false,
    available: new Map(Object.entries(stock)),
    ...extra,
  }
}

const line = (key: string, variantId: string, quantity: number, more: Partial<RoutingLine> = {}) =>
  ({ key, variantId, quantity, tracked: true, preorder: false, ...more }) satisfies RoutingLine

const route = (
  lines: RoutingLine[],
  locations: RoutingLocation[],
  buyerState: string | null = 'KA',
  maxParcels = 2,
) => routeOrder({ lines, locations, buyerState, maxParcels })

function parcels(result: ReturnType<typeof routeOrder>) {
  if (result.kind !== 'routed') throw new Error(`expected routed, got ${result.kind}`)
  return result.parcels
}

describe('routeOrder: one location', () => {
  it('ships from the only location that holds everything', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 2), line('1', 'cap', 1)],
        [at('haryana', { shirt: 1, cap: 5 }), at('delhi', { shirt: 3, cap: 1 })],
      ),
    )
    expect(result).toEqual([
      {
        locationId: 'delhi',
        status: 'open',
        needsTransfer: false,
        lines: [
          { key: '0', quantity: 2 },
          { key: '1', quantity: 1 },
        ],
      },
    ])
  })

  it("prefers the buyer's own state over the merchant's priority", () => {
    const stock = { shirt: 5 }
    const result = parcels(
      route([line('0', 'shirt', 1)], [at('haryana', stock), at('mumbai', stock)], 'MH'),
    )
    expect(result.map((p) => p.locationId)).toEqual(['mumbai'])
  })

  it('then the merchant priority, then the most stock of the order', () => {
    const byPriority = parcels(
      route([line('0', 'shirt', 1)], [at('mumbai', { shirt: 9 }), at('delhi', { shirt: 1 })]),
    )
    expect(byPriority[0]?.locationId).toBe('delhi')
    const byStock = parcels(
      route(
        [line('0', 'shirt', 1)],
        [at('delhi', { shirt: 1 }, { priority: 1 }), at('mumbai', { shirt: 7 }, { priority: 1 })],
      ),
    )
    expect(byStock[0]?.locationId).toBe('mumbai')
  })

  it('counts committed stock as gone (available can be negative)', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1)],
        [at('haryana', { shirt: -2 }), at('delhi', { shirt: 1 })],
        'HR',
      ),
    )
    expect(result[0]?.locationId).toBe('delhi')
  })
})

describe('routeOrder: split into the fewest parcels', () => {
  it('splits across two warehouses when neither holds everything', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1), line('1', 'cap', 1)],
        [at('haryana', { shirt: 1 }), at('delhi', { cap: 1 }), at('mumbai', { shirt: 1, cap: 0 })],
      ),
    )
    expect(result.map((p) => [p.locationId, p.lines])).toEqual([
      ['haryana', [{ key: '0', quantity: 1 }]],
      ['delhi', [{ key: '1', quantity: 1 }]],
    ])
    expect(result.every((p) => !p.needsTransfer && p.status === 'open')).toBe(true)
  })

  it('splits one line across warehouses when no single one has all of it', () => {
    const result = parcels(
      route([line('0', 'shirt', 5)], [at('haryana', { shirt: 3 }), at('delhi', { shirt: 2 })]),
    )
    expect(result.map((p) => [p.locationId, p.lines[0]?.quantity])).toEqual([
      ['haryana', 3],
      ['delhi', 2],
    ])
  })

  it('keeps a line whole where one location of the set can send all of it', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 2), line('1', 'cap', 2)],
        [at('haryana', { shirt: 2, cap: 1 }), at('delhi', { shirt: 2, cap: 2 })],
      ),
    )
    // Delhi alone covers everything: one parcel.
    expect(result).toHaveLength(1)
    expect(result[0]?.locationId).toBe('delhi')
  })

  it('never uses more parcels than the store allows', () => {
    const result = parcels(
      route(
        [line('0', 'a', 1), line('1', 'b', 1), line('2', 'c', 1)],
        [at('haryana', { a: 1 }), at('delhi', { b: 1 }), at('mumbai', { c: 1 })],
        'KA',
        3,
      ),
    )
    expect(result.map((p) => p.locationId)).toEqual(['haryana', 'delhi', 'mumbai'])
  })
})

describe('routeOrder: the home location tops up past its stock', () => {
  it('beyond the parcel limit, the default location takes the rest and needs a transfer', () => {
    const result = parcels(
      route(
        [line('0', 'a', 1), line('1', 'b', 1), line('2', 'c', 1)],
        [at('haryana', { a: 1 }), at('delhi', { b: 1 }), at('mumbai', { c: 1 })],
        'KA',
        2,
      ),
    )
    expect(result).toHaveLength(2)
    const home = result.find((p) => p.locationId === 'haryana')
    expect(home?.needsTransfer).toBe(true)
    // Haryana sends its own a plus whichever item the other parcel cannot.
    expect(home?.lines.map((l) => l.key).sort()).toEqual(['0', '2'])
    expect(result.find((p) => p.locationId === 'delhi')).toMatchObject({
      needsTransfer: false,
      lines: [{ key: '1', quantity: 1 }],
    })
  })

  it('with a limit of one parcel, everything goes from the default location', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1), line('1', 'cap', 1)],
        [at('haryana', { shirt: 1 }), at('delhi', { cap: 1 })],
        'DL',
        1,
      ),
    )
    expect(result).toEqual([
      {
        locationId: 'haryana',
        status: 'open',
        needsTransfer: true,
        lines: [
          { key: '0', quantity: 1 },
          { key: '1', quantity: 1 },
        ],
      },
    ])
  })

  it('picks the partner that leaves the least to transfer', () => {
    const result = parcels(
      route(
        [line('0', 'a', 1), line('1', 'b', 2), line('2', 'c', 1)],
        [
          at('haryana', {}),
          at('delhi', { c: 1 }),
          at('mumbai', { a: 1, b: 1 }),
          at('pune', { b: 1 }),
        ],
        'KA',
        2,
      ),
    )
    // No two warehouses cover it. Mumbai leaves 2 units to move; Delhi or Pune would leave 3.
    expect(result.map((p) => p.locationId)).toEqual(['haryana', 'mumbai'])
    expect(result.find((p) => p.locationId === 'mumbai')).toMatchObject({
      needsTransfer: false,
      lines: [
        { key: '0', quantity: 1 },
        { key: '1', quantity: 1 },
      ],
    })
    expect(result.find((p) => p.locationId === 'haryana')).toMatchObject({
      needsTransfer: true,
      lines: [
        { key: '1', quantity: 1 },
        { key: '2', quantity: 1 },
      ],
    })
  })
})

describe('routeOrder: not enough anywhere', () => {
  it('is out of stock when every location together is short', () => {
    expect(
      route([line('0', 'shirt', 4)], [at('haryana', { shirt: 1 }), at('delhi', { shirt: 2 })]),
    ).toEqual({ kind: 'out_of_stock', variantId: 'shirt' })
  })

  it('a pre-order line waits on hold at the default location; the rest ships now', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1), line('1', 'drop', 2, { preorder: true })],
        [at('haryana', {}), at('delhi', { shirt: 1, drop: 1 })],
      ),
    )
    expect(result).toEqual([
      {
        locationId: 'delhi',
        status: 'open',
        needsTransfer: false,
        lines: [{ key: '0', quantity: 1 }],
      },
      {
        locationId: 'haryana',
        status: 'on_hold',
        needsTransfer: false,
        lines: [{ key: '1', quantity: 2 }],
      },
    ])
  })

  it('a pre-order line in stock somewhere ships like any other', () => {
    const result = parcels(
      route(
        [line('0', 'drop', 1, { preorder: true })],
        [at('haryana', {}), at('delhi', { drop: 1 })],
      ),
    )
    expect(result).toEqual([expect.objectContaining({ locationId: 'delhi', status: 'open' })])
  })
})

describe('routeOrder: composition GSTINs never ship to another state', () => {
  it('skips a composition warehouse for a buyer in another state', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1)],
        [at('haryana', { shirt: 5 }, { composition: true }), at('delhi', { shirt: 1 })],
        'MH',
      ),
    )
    expect(result[0]?.locationId).toBe('delhi')
  })

  it('a composition warehouse still ships within its own state', () => {
    const result = parcels(
      route([line('0', 'shirt', 1)], [at('haryana', { shirt: 5 }, { composition: true })], 'HR'),
    )
    expect(result[0]?.locationId).toBe('haryana')
  })

  it('judges the GSTIN state, not where the building is', () => {
    const result = route(
      [line('0', 'shirt', 1)],
      [at('delhi', { shirt: 5 }, { composition: true, gstStateCode: 'HR' })],
      'DL',
    )
    expect(result).toEqual({ kind: 'no_location' })
  })

  it('refuses when only composition warehouses in other states could send it', () => {
    expect(
      route(
        [line('0', 'shirt', 1)],
        [
          at('haryana', { shirt: 5 }, { composition: true }),
          at('delhi', { shirt: 5 }, { composition: true }),
        ],
        'KA',
      ),
    ).toEqual({ kind: 'no_location' })
  })

  it('a stocked composition warehouse being skipped can leave the rest out of stock', () => {
    expect(
      route(
        [line('0', 'shirt', 2)],
        [at('haryana', { shirt: 5 }, { composition: true }), at('delhi', { shirt: 1 })],
        'KA',
      ),
    ).toEqual({ kind: 'out_of_stock', variantId: 'shirt' })
  })

  it('cannot judge without the buyer’s state, so it does not refuse', () => {
    const result = parcels(
      route([line('0', 'shirt', 1)], [at('haryana', { shirt: 5 }, { composition: true })], null),
    )
    expect(result[0]?.locationId).toBe('haryana')
  })
})

describe('routeOrder: untracked goods', () => {
  it('ride with the first parcel', () => {
    const result = parcels(
      route(
        [line('0', 'shirt', 1), line('1', 'engraving', 1, { tracked: false })],
        [at('haryana', {}), at('delhi', { shirt: 1 })],
      ),
    )
    expect(result).toEqual([
      expect.objectContaining({
        locationId: 'delhi',
        lines: [
          { key: '0', quantity: 1 },
          { key: '1', quantity: 1 },
        ],
      }),
    ])
  })

  it('on their own go from the most preferred location', () => {
    const result = parcels(
      route(
        [line('0', 'ebook', 1, { tracked: false })],
        [at('haryana', {}), at('mumbai', {})],
        'MH',
      ),
    )
    expect(result.map((p) => p.locationId)).toEqual(['mumbai'])
  })

  it('an order with no goods has no parcels', () => {
    expect(route([line('0', 'shirt', 0)], [at('haryana', {})])).toEqual({
      kind: 'routed',
      parcels: [],
    })
  })
})
