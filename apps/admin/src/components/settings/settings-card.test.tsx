// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DataCard from '@/components/layout/data-card'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SettingsCard from './settings-card'
import SettingsTable from './settings-table'
import SettingsTableCell from './settings-table-cell'
import SettingsTableRow from './settings-table-row'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }))

describe('SettingsCard', () => {
  it('is a DataCard: the same card, title size and help line', () => {
    const { container } = render(
      <SettingsCard title="Store name" description="Shown on invoices">
        <p>body</p>
      </SettingsCard>,
    )
    const real = render(
      <DataCard title="Store name" subtitle="Shown on invoices">
        <p>body</p>
      </DataCard>,
    ).container
    const heading = screen.getAllByRole('heading', { name: 'Store name' })[0]
    expect(heading?.className).toContain('text-card-title')
    expect(container.querySelector('[data-slot="card"]')).toBeTruthy()
    expect(container.querySelector('h2')?.className).toBe(real.querySelector('h2')?.className)
  })

  it('draws no header row when it has no title or line', () => {
    const { container } = render(
      <SettingsCard>
        <p>only rows</p>
      </SettingsCard>,
    )
    expect(container.querySelector('h2')).toBeNull()
    expect(container.querySelector('.min-h-9')).toBeNull()
    expect(container.querySelector('.mt-4')).toBeNull()
  })
})

describe('SettingsTable', () => {
  it('draws a DataCard with the card title and a SimpleTable', () => {
    render(
      <SettingsTable
        heading="Team"
        columns={[{ label: 'Name' }, { label: 'Status', center: true }]}
        actions
        total={1}
      >
        <SettingsTableRow>
          <SettingsTableCell>Asha</SettingsTableCell>
          <SettingsTableCell center>Active</SettingsTableCell>
          <SettingsTableCell />
        </SettingsTableRow>
      </SettingsTable>,
    )
    expect(screen.getByRole('heading', { name: 'Team' }).className).toContain('text-card-title')
    const heads = screen.getAllByRole('columnheader')
    expect(heads).toHaveLength(3)
    expect(heads[1]?.className).toContain('text-center')
    expect(screen.getByRole('table').className).toContain('h-15')
    expect(screen.getByText(/1/, { selector: 'p' })).toBeTruthy()
  })
})

describe('SectionPageSkeleton rows', () => {
  it('draws one row list in place of the form cards', () => {
    const { container } = render(<SectionPageSkeleton rows={4} header={false} />)
    expect(container.querySelectorAll('li')).toHaveLength(4)
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0)
  })
})
