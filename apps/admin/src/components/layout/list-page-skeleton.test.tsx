// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatStrip from '@/components/layout/stat-strip'
import OrdersListSkeleton from '@/components/orders/orders-list-skeleton'
import ResourceTable from '@/components/table/resource-table'
import { CELL, HEAD, TOOLBAR_ROW } from '@/components/table/resource-table/styles'
import { ordersContent } from '@/data/orders'
import { formatters } from '@/lib/format'
import { orderColumns } from '@/lib/order-columns'
import { ORDER_COLUMNS_KEY, ORDER_DEFAULT_SORT, ORDER_HIDDEN_COLUMNS } from '@/lib/order-list-table'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

/** The class list of every header cell, in order. */
function headClasses(root: HTMLElement): string[] {
  return [...root.querySelectorAll('thead th')].map((th) => th.className)
}

describe('list page skeleton', () => {
  it('uses the loaded list page frame (gutter and rhythm)', () => {
    const skeleton = render(<ListPageSkeleton />).container.firstElementChild
    const page = render(
      <ProoflyListPage title="Orders">
        <div />
      </ProoflyListPage>,
    ).container.firstElementChild
    expect(skeleton?.className).toBe(page?.className)
  })

  it('draws the header at the loaded heights: a 2.25rem title line and a 1.25rem summary', () => {
    const { container } = render(<ListPageSkeleton tiles={0} />)
    expect(container.querySelector('.h-9 > [data-slot="skeleton"], .h-9 > div')).toBeTruthy()
    expect(container.querySelector('.h-5')).toBeTruthy()
  })

  it('draws the stat strip as joined skeleton cells, or none', () => {
    const four = render(<ListPageSkeleton tiles={4} />).container
    const strip = four.querySelector('[aria-busy="true"].grid')
    expect(strip?.children.length).toBe(4)
    const none = render(<ListPageSkeleton tiles={0} />).container
    expect(none.querySelector('.grid[aria-busy="true"]')).toBeNull()
  })

  it('draws the generic table card with the real toolbar row, header and row heights', () => {
    const { container } = render(<ListPageSkeleton />)
    expect(container.querySelector(`[class="${TOOLBAR_ROW}"]`)).toBeTruthy()
    expect(container.querySelector('thead th')?.className).toContain(HEAD.split(' ')[0])
    const cells = [...container.querySelectorAll('tbody td')]
    expect(cells.length).toBeGreaterThan(0)
    for (const td of cells) expect(td.className).toContain('h-15')
  })
})

describe('stat strip loading', () => {
  it('keeps each cell and its label, with bars in place of the figures', () => {
    const { container, getByText, queryByText } = render(
      <StatStrip
        loading
        tiles={[
          { id: 'a', label: 'New today', value: '12', note: 'since midnight' },
          { id: 'b', label: 'Ready to ship', value: '4', note: 'paid, not packed' },
        ]}
      />,
    )
    expect(getByText('New today')).toBeTruthy()
    expect(queryByText('12')).toBeNull()
    // The figure's box is the `text-stat` line height (2.25rem), the note's 1rem.
    expect(container.querySelectorAll('.h-9').length).toBe(2)
    expect(container.querySelectorAll('.h-4').length).toBe(2)
    expect(container.querySelector('button')).toBeNull()
  })

  it('draws the figures with the type tokens once loaded', () => {
    const { getByText } = render(
      <StatStrip tiles={[{ id: 'a', label: 'New today', value: '12' }]} />,
    )
    expect(getByText('12').className).toContain('text-stat')
    expect(getByText('New today').className).toContain('text-caption')
  })
})

describe('Orders list skeleton', () => {
  it('has the same columns, header cells and row height as the loaded Orders table', () => {
    const skeleton = render(<OrdersListSkeleton />).container
    const loaded = render(
      <ResourceTable
        resourceName={ordersContent.resource}
        columns={orderColumns(ordersContent, formatters('en'))}
        items={[]}
        getId={(o) => o.id}
        href={() => ''}
        rowActions={() => null}
        defaultSort={ORDER_DEFAULT_SORT}
        columnsStorageKey={ORDER_COLUMNS_KEY}
        defaultHidden={ORDER_HIDDEN_COLUMNS}
        query=""
        onQueryChange={() => undefined}
        page={1}
        perPage={25}
        total={0}
        onPageChange={() => undefined}
      />,
    ).container

    const heads = headClasses(skeleton)
    expect(heads.length).toBeGreaterThan(5)
    expect(heads).toEqual(headClasses(loaded))
    expect(skeleton.querySelector('thead')?.textContent).toBe(
      loaded.querySelector('thead')?.textContent,
    )
    const firstRow = skeleton.querySelector('tbody tr')
    expect(firstRow?.children.length).toBe(heads.length)
    for (const td of firstRow?.children ?? []) expect(td.className).toContain(CELL)
    // The real page title, and the toolbar's view select reads the first view.
    expect(skeleton.querySelector('h1')?.textContent).toBe(ordersContent.title)
    expect(skeleton.textContent).toContain(ordersContent.tabs.all)
  })
})
