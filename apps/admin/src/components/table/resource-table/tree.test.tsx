// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ResourceTable from './index'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

type Item = { id: string; name: string; children?: Item[] }

const ITEMS: Item[] = [
  {
    id: 'p1',
    name: 'Saturn Pro',
    children: [
      { id: 'v1', name: 'Saturn Pro / Black' },
      { id: 'v2', name: 'Saturn Pro / White' },
    ],
  },
  { id: 'v3', name: 'Zed' },
]

function Tree({ onSelect }: { onSelect: (ids: string[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return (
    <ResourceTable<Item>
      resourceName={{ singular: 'SKU', plural: 'SKUs' }}
      columns={[{ id: 'name', title: 'Name', render: (i) => <span>{i.name}</span> }]}
      items={ITEMS}
      getId={(i) => i.id}
      tree={{ getSubRows: (i) => i.children, expanded, onExpandedChange: setExpanded }}
      query=""
      onQueryChange={() => undefined}
      page={1}
      perPage={25}
      total={2}
      onPageChange={() => undefined}
      bulkActions={(ids) => {
        onSelect(ids)
        return null
      }}
    />
  )
}

describe('ResourceTable tree', () => {
  it('folds sub rows under their row and opens them on a row click', () => {
    render(<Tree onSelect={() => undefined} />)
    expect(screen.queryByText('Saturn Pro / Black')).toBeNull()
    fireEvent.click(screen.getByText('Saturn Pro'))
    expect(screen.getByText('Saturn Pro / Black')).toBeTruthy()
    expect(screen.getByText('Saturn Pro / White')).toBeTruthy()
    fireEvent.click(screen.getByText('Saturn Pro'))
    expect(screen.queryByText('Saturn Pro / Black')).toBeNull()
  })

  it('ticking a folded row selects only its sub rows', () => {
    const onSelect = vi.fn()
    render(<Tree onSelect={onSelect} />)
    const parent = screen.getByText('Saturn Pro').closest('tr') as HTMLElement
    fireEvent.click(within(parent).getByRole('checkbox'))
    expect(onSelect).toHaveBeenLastCalledWith(['v1', 'v2'])
  })
})
