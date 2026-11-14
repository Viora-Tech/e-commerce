// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CustomersListSkeleton from '@/components/customers/customers-list-skeleton'
import ResourceTable from '@/components/table/resource-table'
import { CELL } from '@/components/table/resource-table/styles'
import { customersContent } from '@/data/customers'
import { customerColumns } from './customer-columns'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

/** The class list of every header cell, in order. */
function headClasses(root: HTMLElement): string[] {
  return [...root.querySelectorAll('thead th')].map((th) => th.className)
}

describe('Customers list skeleton', () => {
  it('has the same columns, header cells and row height as the loaded Customers table', () => {
    const skeleton = render(<CustomersListSkeleton />).container
    const loaded = render(
      <ResourceTable
        resourceName={customersContent.resource}
        columns={customerColumns(customersContent)}
        items={[]}
        getId={(c) => c.id}
        href={() => ''}
        rowActions={() => null}
        query=""
        onQueryChange={() => undefined}
        page={1}
        perPage={25}
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
    const firstRow = skeleton.querySelector('tbody tr')
    expect(firstRow?.children.length).toBe(heads.length)
    for (const td of firstRow?.children ?? []) expect(td.className).toContain(CELL)
  })

  it('draws the real title and the four-tile strip', () => {
    const { container } = render(<CustomersListSkeleton />)
    expect(container.querySelector('h1')?.textContent).toBe(customersContent.heading)
    expect(container.querySelector('[aria-busy="true"].grid')?.children.length).toBe(4)
    expect(container.textContent).toContain(customersContent.tabs.all)
  })
})
