// @vitest-environment jsdom
import { LOW_STOCK_THRESHOLD } from '@commerce/core/catalog'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SwitchRow from '@/components/fields/switch-row'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import { productColumns } from '@/components/products/product-columns'
import ProductPageSkeleton from '@/components/products/product-page-skeleton'
import ProductsListSkeleton from '@/components/products/products-list-skeleton'
import VariantPageColumns from '@/components/products/variant-page/variant-page-columns'
import VariantPageSkeleton from '@/components/products/variant-page/variant-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import { productsListContent } from '@/data/products'
import { formatters } from '@/lib/format'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/products',
  useSearchParams: () => new URLSearchParams(),
}))

/** The class list of every header cell, in order. */
function headClasses(root: HTMLElement): string[] {
  return [...root.querySelectorAll('thead th')].map((th) => th.className)
}

describe('Products list skeleton', () => {
  it('has the loaded Products table header, the title, three buttons and four tiles', () => {
    const skeleton = render(<ProductsListSkeleton />).container
    const loaded = render(
      <ResourceTable
        resourceName={productsListContent.resource}
        columns={productColumns(productsListContent, formatters('en'), LOW_STOCK_THRESHOLD)}
        items={[]}
        getId={(p) => p.id}
        href={() => ''}
        rowActions={() => null}
        query=""
        onQueryChange={() => undefined}
        page={1}
        perPage={50}
        total={0}
        onPageChange={() => undefined}
      />,
    ).container

    const heads = headClasses(skeleton)
    expect(heads.length).toBeGreaterThan(3)
    expect(heads).toEqual(headClasses(loaded))
    expect(skeleton.querySelector('thead')?.textContent).toBe(
      loaded.querySelector('thead')?.textContent,
    )
    expect(skeleton.querySelector('h1')?.textContent).toBe(productsListContent.title)
    expect(skeleton.querySelector('[aria-busy="true"].grid')?.children.length).toBe(4)
  })
})

describe('page header skeleton lead', () => {
  it('draws the 3rem record tile before the title only when asked', () => {
    const withLead = render(<PageHeaderSkeleton back lead />).container
    expect(withLead.querySelector('.size-12')).toBeTruthy()
    const without = render(<PageHeaderSkeleton back />).container
    expect(without.querySelector('.size-12')).toBeNull()
  })
})

describe('product page skeleton', () => {
  it('draws the tab strip and three header buttons, one for a new product', () => {
    const saved = render(<ProductPageSkeleton />).container
    expect(saved.querySelector('.h-11.border-b')).toBeTruthy()
    expect(saved.querySelectorAll('.h-9.rounded-sm').length).toBe(3)
    const fresh = render(<ProductPageSkeleton isNew />).container
    expect(fresh.querySelectorAll('.h-9.rounded-sm').length).toBe(1)
  })
})

describe('variant page skeleton', () => {
  it('uses the same two columns as the variant page', () => {
    const skeleton = render(<VariantPageSkeleton />).container
    const page = render(<VariantPageColumns list={<div />} main={<div />} />).container
    const grid = page.firstElementChild?.className
    expect(grid).toContain('lg:grid-cols-[18rem_minmax(0,1fr)]')
    expect(skeleton.querySelector(`[class="${grid}"]`)).toBeTruthy()
    expect(skeleton.querySelector('aside')).toBeTruthy()
  })
})

describe('switch row', () => {
  it('labels the switch and shows its help and extra line', () => {
    const onChange = vi.fn()
    const { getByRole, getByText } = render(
      <SwitchRow
        id="taxable"
        label="Charge tax"
        description="Adds GST"
        checked={false}
        onChange={onChange}
        weight="normal"
      >
        <p>18% GST</p>
      </SwitchRow>,
    )
    expect(getByRole('switch', { name: 'Charge tax' })).toBeTruthy()
    expect(getByText('Adds GST')).toBeTruthy()
    expect(getByText('18% GST')).toBeTruthy()
    fireEvent.click(getByRole('switch'))
    expect(onChange.mock.calls[0]?.[0]).toBe(true)
  })
})
