// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { segmentsContent } from '@/data/customers'
import { routes } from '@/lib/routes'
import SegmentsList from './segments-list'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

const SEGMENT = {
  id: 'seg-1',
  name: 'Repeat buyers',
  rules: { match: 'all' as const, conditions: [] },
  customerCount: 12,
  updatedAt: new Date('2026-11-01T10:00:00Z'),
}

describe('Segments list', () => {
  it('draws the segments as a table with the list header and one row each', () => {
    const { container, getByRole } = render(
      <SegmentsList
        segments={[SEGMENT] as unknown as Parameters<typeof SegmentsList>[0]['segments']}
      />,
    )
    const heads = [...container.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(heads.slice(0, 3)).toEqual([
      segmentsContent.columns.name,
      segmentsContent.columns.customers,
      segmentsContent.columns.updated,
    ])
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(getByRole('link', { name: SEGMENT.name }).getAttribute('href')).toBe(
      routes.customers.segment(SEGMENT.id),
    )
    expect(container.textContent).toContain(segmentsContent.builder.previewCount(12))
  })

  it('shows the empty state with Create segment when there are none', () => {
    const { getByText, container } = render(<SegmentsList segments={[]} />)
    expect(getByText(segmentsContent.empty.heading)).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
  })
})
