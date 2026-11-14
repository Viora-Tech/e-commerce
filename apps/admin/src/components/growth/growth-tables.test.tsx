// @vitest-environment jsdom
import type { CampaignRow } from '@commerce/api'
import type { PlanBill } from '@commerce/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BillsCard from '@/components/billing/bills-card'
import MarketsAreaSkeleton from '@/components/markets/markets-area-skeleton'
import { HEAD } from '@/components/table/resource-table/styles'
import { billingContent } from '@/data/billing'
import { growthOverviewContent } from '@/data/growth'
import TopCampaignsCard from './top-campaigns-card'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/growth',
  useSearchParams: () => new URLSearchParams(),
}))

/** The header texts, and whether the first one carries the list table's header style. */
function heads() {
  const cells = screen.getAllByRole('columnheader')
  return {
    labels: cells.map((h) => h.textContent),
    listStyle: HEAD.split(' ')
      .filter((c) => !c.includes(':'))
      .every((c) => cells[0]?.className.includes(c)),
  }
}

const campaign: CampaignRow = {
  key: 'our:1',
  kind: 'email',
  name: 'Diwali sale',
  href: '/growth/campaigns/1',
  source: null,
  medium: null,
  sessions: 120,
  orders: 4,
  salesPaise: 480_000,
  sourceKey: 'email',
}

describe('growth, billing and markets tables on SimpleTable', () => {
  it('Top campaigns: the list header and one row per campaign, in a titled card', () => {
    render(<TopCampaignsCard rows={[campaign]} />)
    const c = growthOverviewContent.campaigns
    expect(screen.getByRole('heading', { name: c.title })).toBeTruthy()
    const h = heads()
    expect(h.labels).toEqual([
      c.columns.campaign,
      c.columns.source,
      c.columns.sessions,
      c.columns.orders,
      c.columns.sales,
    ])
    expect(h.listStyle).toBe(true)
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('Invoices: named columns over each bill', () => {
    const bill: PlanBill = {
      id: 'b1',
      plan: 'starter',
      interval: 'month',
      number: 1042,
      amountPaise: 99_900,
      periodStart: new Date('2026-10-01T00:00:00Z'),
      periodEnd: new Date('2026-11-01T00:00:00Z'),
      status: 'paid',
      paidAt: new Date('2026-10-01T00:00:00Z'),
      url: 'https://pay.example/1042',
    }
    render(<BillsCard bills={[bill]} />)
    const cols = billingContent.bills.columns
    expect(heads().labels).toEqual([cols.invoice, cols.period, cols.amount, cols.status, ''])
    expect(screen.getByText('#1042')).toBeTruthy()
  })

  it('Markets area skeleton: the real columns over placeholder rows', () => {
    render(
      <MarketsAreaSkeleton title="Rollouts" columns={[{ label: 'Name' }, { label: 'Status' }]} />,
    )
    expect(screen.getByRole('heading', { name: 'Rollouts' })).toBeTruthy()
    expect(heads().labels).toEqual(['Name', 'Status'])
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })
})
