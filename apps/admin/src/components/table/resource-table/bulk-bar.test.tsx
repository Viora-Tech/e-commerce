// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ResourceTable from './index'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Item = { id: string; name: string }

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
]

function List({ onAction }: { onAction: (ids: string[]) => void }) {
  return (
    <ResourceTable<Item>
      resourceName={{ singular: 'order', plural: 'orders' }}
      columns={[{ id: 'name', title: 'Name', render: (i) => <span>{i.name}</span> }]}
      items={ITEMS}
      getId={(i) => i.id}
      query=""
      onQueryChange={() => undefined}
      page={1}
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
})
