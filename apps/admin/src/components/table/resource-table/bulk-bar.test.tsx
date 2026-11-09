// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ViewSelect from '../view-select'
import ResourceTable from './index'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Item = { id: string; name: string }

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
]

type Scope = { view?: string | null; query?: string; page?: number; status?: string[] }

function List({ onAction, scope = {} }: { onAction: (ids: string[]) => void; scope?: Scope }) {
  return (
    <ResourceTable<Item>
      views={
        <ViewSelect<string | null>
          value={scope.view ?? null}
          options={[
            { value: null, label: 'All' },
            { value: 'unfulfilled', label: 'Unfulfilled' },
          ]}
          onChange={() => undefined}
        />
      }
      filterGroups={[
        {
          type: 'checks',
          key: 'status',
          label: 'Status',
          options: [{ value: 'paid', label: 'Paid' }],
          value: scope.status ?? [],
          onChange: () => undefined,
        },
      ]}
      resourceName={{ singular: 'order', plural: 'orders' }}
      columns={[{ id: 'name', title: 'Name', render: (i) => <span>{i.name}</span> }]}
      items={ITEMS}
      getId={(i) => i.id}
      query={scope.query ?? ''}
      onQueryChange={() => undefined}
      page={scope.page ?? 1}
      perPage={25}
      total={3}
      onPageChange={() => undefined}
      bulkActions={(ids, clear) => (
        <button
          type="button"
          onClick={() => {
            onAction(ids)
            clear()
          }}
        >
          Archive
        </button>
      )}
    />
  )
}

function tick(name: string) {
  const row = screen.getByText(name).closest('tr') as HTMLElement
  fireEvent.click(within(row).getByRole('checkbox'))
}

describe('ResourceTable bulk bar', () => {
  it('turns the header row into the bulk bar while rows are ticked', () => {
    const onAction = vi.fn()
    const { container } = render(<List onAction={onAction} />)
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    tick('Alpha')
    tick('Charlie')
    expect(screen.getByRole('button', { name: 'Selection options' }).textContent).toContain(
      '2 orders selected',
    )
    expect(container.querySelector('thead')?.hasAttribute('inert')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    expect(onAction).toHaveBeenCalledWith(['a', 'c'])
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  it('shows only the ticked rows, then every row again', () => {
    render(<List onAction={() => undefined} />)
    tick('Bravo')
    const toggle = screen.getByRole('button', { name: 'Show all selected' })
    fireEvent.click(toggle)
    expect(screen.queryByText('Alpha')).toBeNull()
    expect(screen.getByText('Bravo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show all rows' }))
    expect(screen.getByText('Alpha')).toBeTruthy()
  })

  it.each<[string, Scope]>([
    ['the view (tab)', { view: 'unfulfilled' }],
    ['a filter', { status: ['paid'] }],
    ['the search', { query: 'alp' }],
    ['the page', { page: 2 }],
  ])('clears the selection when %s changes', (_, scope) => {
    const { rerender } = render(<List onAction={() => undefined} />)
    tick('Alpha')
    expect(screen.getByRole('button', { name: 'Selection options' }).textContent).toContain(
      '1 order selected',
    )
    rerender(<List onAction={() => undefined} scope={scope} />)
    expect(screen.queryByRole('button', { name: 'Selection options' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  it('keeps the selection when the same rows render again', () => {
    const { rerender } = render(<List onAction={() => undefined} />)
    tick('Alpha')
    rerender(<List onAction={() => undefined} />)
    expect(screen.getByRole('button', { name: 'Selection options' }).textContent).toContain(
      '1 order selected',
    )
  })
})
