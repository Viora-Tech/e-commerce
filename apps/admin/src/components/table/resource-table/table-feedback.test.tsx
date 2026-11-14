// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResourceTable from './index'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Item = { id: string; name: string }

const ITEMS: Item[] = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, name: `Row ${i}` }))

type Props = {
  items?: Item[]
  loading?: boolean
  query?: string
  error?: { heading?: string; onRetry: () => void }
}

function List({ items = ITEMS, loading = false, query = '', error }: Props) {
  return (
    <ResourceTable<Item>
      resourceName={{ singular: 'order', plural: 'orders' }}
      columns={[{ id: 'name', title: 'Name', render: (i) => <span>{i.name}</span> }]}
      items={items}
      getId={(i) => i.id}
      loading={loading}
      error={error}
      query={query}
      onQueryChange={() => undefined}
      page={1}
      perPage={25}
      total={items.length}
      onPageChange={() => undefined}
      empty={{ heading: 'No orders yet' }}
      noResults={{ heading: 'No orders match' }}
    />
  )
}

describe('ResourceTable states', () => {
  it('shows a failed read with Try again in place of the rows, never the empty state', () => {
    const onRetry = vi.fn()
    render(<List items={[]} error={{ heading: 'Could not load orders', onRetry }} />)
    expect(screen.getByRole('alert').textContent).toContain('Could not load orders')
    expect(screen.queryByText('No orders yet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('hides stale rows and the pager while the read has failed', () => {
    render(<List error={{ onRetry: () => undefined }} />)
    expect(screen.queryByText('Row 0')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Could not load the orders')
  })

  it('tells empty from no results', () => {
    const { rerender } = render(<List items={[]} />)
    expect(screen.getByText('No orders yet')).toBeTruthy()
    rerender(<List items={[]} query="zzz" />)
    expect(screen.getByText('No orders match')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy()
  })

  it('keeps the rows’ height while a page reloads (one skeleton row per row on screen)', () => {
    const { container, rerender } = render(<List />)
    expect(container.querySelectorAll('tbody tr').length).toBe(9)
    rerender(<List loading />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows.length).toBe(9)
    expect(rows[0]?.getAttribute('aria-busy')).toBe('true')
    expect(rows[0]?.querySelector('td')?.className).toContain('h-15')
  })
})
