// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { inventoryContent, purchaseOrdersContent, transfersContent } from '@/data/inventory'
import { inboundShipmentsContent, suppliersContent } from '@/data/purchasing'
import InboundShipmentsSkeleton from './inbound-shipments/inbound-shipments-skeleton'
import {
  type InventoryQuery,
  inventoryFilterGroups,
  NO_INVENTORY_FACETS,
  PER_PAGE,
} from './inventory/inventory-query'
import InventorySkeleton from './inventory/inventory-skeleton'
import PurchaseOrdersSkeleton from './purchase-orders/purchase-orders-skeleton'
import SuppliersSkeleton from './suppliers/suppliers-skeleton'
import TransfersSkeleton from './transfers/transfers-skeleton'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const FIRST_PAGE: InventoryQuery = {
  page: 1,
  perPage: PER_PAGE,
  query: '',
  stock: null,
  vendor: [],
  productType: [],
  tag: [],
  collection: [],
  productStatus: [],
  changed: null,
  group: 'product',
}

/** The header text of the skeleton's table. */
function headText(root: HTMLElement): string {
  return root.querySelector('thead')?.textContent ?? ''
}

describe('stock list skeletons', () => {
  it('Inventory: real title, the location and reason row, no tiles and the real columns', () => {
    const { container } = render(<InventorySkeleton />)
    expect(container.querySelector('h1')?.textContent).toBe(inventoryContent.heading)
    expect(container.querySelector('label[for="inventory-location"]')).toBeTruthy()
    expect(container.querySelector('label[for="inventory-reason"]')).toBeTruthy()
    expect(container.querySelector('.grid[aria-busy="true"]')).toBeNull()
    expect(headText(container)).toContain(inventoryContent.columns.product)
    expect(headText(container)).toContain(inventoryContent.columns.available)
  })

  it('Purchase orders: no tiles and the list columns', () => {
    const { container } = render(<PurchaseOrdersSkeleton />)
    expect(container.querySelector('h1')?.textContent).toBe(purchaseOrdersContent.heading)
    expect(container.querySelector('.grid[aria-busy="true"]')).toBeNull()
    expect(headText(container)).toContain(purchaseOrdersContent.columns.supplier)
  })

  it('Transfers, inbound shipments and suppliers: no tiles, the real columns', () => {
    const cases = [
      [<TransfersSkeleton key="t" />, transfersContent.heading, transfersContent.columns.from],
      [
        <InboundShipmentsSkeleton key="i" />,
        inboundShipmentsContent.heading,
        inboundShipmentsContent.columns.status,
      ],
      [<SuppliersSkeleton key="s" />, suppliersContent.heading, suppliersContent.columns.name],
    ] as const
    for (const [node, heading, column] of cases) {
      const { container, unmount } = render(node)
      expect(container.querySelector('h1')?.textContent).toBe(heading)
      expect(container.querySelector('.grid[aria-busy="true"]')).toBeNull()
      expect(headText(container)).toContain(column)
      unmount()
    }
  })
})

describe('inventory filter groups', () => {
  it('lists the seven filters and sends every change back to the first page', () => {
    const patches: unknown[] = []
    const groups = inventoryFilterGroups(
      FIRST_PAGE,
      inventoryContent.filters,
      NO_INVENTORY_FACETS,
      (p) => patches.push(p),
    )
    expect(groups.map((g) => g.key)).toEqual([
      'stock',
      'changed',
      'collection',
      'vendor',
      'type',
      'tag',
      'productStatus',
    ])
    const stock = groups[0]
    if (stock?.type === 'select') stock.onChange('low')
    expect(patches).toEqual([{ stock: 'low', page: 1 }])
  })
})
