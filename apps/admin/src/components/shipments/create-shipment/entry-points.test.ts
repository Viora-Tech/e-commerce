import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Every "Ship" button opens the one Create shipment flow: no screen books a courier on its
 * own (the order page used to book the store's first courier straight away, with no choice).
 */

const SRC = fileURLToPath(new URL('../../../', import.meta.url))
const FLOW_DIR = ['components', 'shipments', 'create-shipment'].join(sep)

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, 'utf8'),
}))
const read = (rel: string) => files.find((f) => f.path === rel.split('/').join(sep))?.text ?? ''

/** Calls that book a parcel with a courier, or ask couriers for rates. */
const BOOKING_CALLS = [
  'api.orders.createShipment(',
  'api.shipments.bulkBook(',
  'api.shipments.quote(',
]

describe('Create shipment entry points', () => {
  it('only the Create shipment flow books couriers or asks them for rates', () => {
    const outside = files
      .filter((f) => !f.path.startsWith(FLOW_DIR))
      .flatMap((f) =>
        BOOKING_CALLS.filter((call) => f.text.includes(call)).map((call) => `${f.path}: ${call}`),
      )
    expect(outside).toEqual([])
  })

  it('one order opens the Create shipment page; several open the shared bulk dialog', () => {
    const view = read('components/orders/order-view.tsx')
    expect(view).toContain('routes.orders.ship(order.id)')
    const workspace = read('components/shipments/shipments-workspace.tsx')
    expect(workspace).toContain('routes.orders.ship(')
    expect(workspace).toMatch(
      /import CreateShipmentDialog from '[^']*create-shipment\/create-shipment-dialog'/,
    )
    expect(workspace).toContain('<CreateShipmentDialog')
    expect(read('app/(admin)/orders/[id]/ship/page.tsx')).toContain('<CreateShipmentPage')
  })

  it('the order page sends Create shipment (next step and shipment card) to the flow', () => {
    const view = read('components/orders/order-view.tsx')
    expect(view).toMatch(/onShip=\{handleShip\}/)
    expect(view).toMatch(/onBook=\{handleShip\}/)
    // The next-step card used to link off to Orders → Shipments instead of choosing a courier.
    expect(read('components/orders/order-next-step.tsx')).not.toContain('routes.orders.shipments')
  })

  it('book by order number hands its orders to the flow instead of booking them', () => {
    const panel = read('components/shipments/book-shipments-panel.tsx')
    expect(panel).toContain('onShip(')
    expect(read('components/shipments/shipment-sheets.tsx')).toContain('onShip={onShip}')
  })

  it('the old one-off booking dialogs are gone', () => {
    const paths = files.map((f) => f.path)
    expect(paths).not.toContain(['components', 'shipments', 'book-dialog.tsx'].join(sep))
    expect(paths).not.toContain(['components', 'shipments', 'courier-compare-table.tsx'].join(sep))
  })
})
