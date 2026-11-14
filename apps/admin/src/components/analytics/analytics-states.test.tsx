// @vitest-environment jsdom
import type { ReportDefinition, ReportResult } from '@commerce/api'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AnalyticsSkeleton from '@/components/analytics/analytics-skeleton'
import RangeFailed from '@/components/analytics/range-failed'
import ReportSkeleton from '@/components/analytics/report-skeleton'
import ReportTable from '@/components/analytics/report-table'
import ReportsHomeSkeleton from '@/components/analytics/reports-home-skeleton'
import ChartCard from '@/components/layout/chart-card'
import { analyticsContent } from '@/data/analytics'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/analytics',
  useSearchParams: () => new URLSearchParams(),
}))

const report: ReportDefinition = {
  slug: 'sales-by-day',
  title: 'Sales by day',
  description: '',
  category: 'sales',
  available: true,
  columns: [
    { id: 'day', kind: 'text' },
    { id: 'orders', kind: 'count' },
  ],
  metric: 'orders',
  chart: 'series',
  ranged: true,
}

const result: ReportResult = {
  slug: 'sales-by-day',
  range: { key: '7d', from: '2026-11-01', to: '2026-11-07', days: [] },
  previousRange: null,
  rows: [
    { key: 'a', values: { day: 'Monday', orders: 4 }, previous: null },
    { key: 'b', values: { day: 'Tuesday', orders: 6 }, previous: null },
  ],
  totals: { orders: 10 },
  previousTotals: null,
  chart: [],
  profit: null,
} as unknown as ReportResult

describe('Analytics failure state', () => {
  it('says what could not load and offers Try again', () => {
    const retry = vi.fn()
    const view = render(
      <RangeFailed failed="error" heading={analyticsContent.loadFailed} onRetry={retry} />,
    )
    expect(view.getByText(analyticsContent.loadFailed)).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows no access, without a retry, for a role that may not read it', () => {
    const view = render(
      <RangeFailed failed="no-access" heading={analyticsContent.loadFailed} onRetry={vi.fn()} />,
    )
    expect(view.queryByText(analyticsContent.loadFailed)).toBeNull()
    expect(view.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

describe('ChartCard while loading', () => {
  it('draws a skeleton in the chart frame and keeps the title', () => {
    const view = render(
      <ChartCard
        title="Sales over time"
        subtitle="₹100 in the last 7 days"
        periods={[{ id: 'day', label: 'By day', data: [{ label: '1 Nov', value: 1 }] }]}
        formatValue={String}
        loading
      />,
    )
    expect(view.getByText('Sales over time')).toBeTruthy()
    expect(view.container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe('ReportTable', () => {
  it('draws the rows and the totals on the shared SimpleTable', () => {
    const view = render(<ReportTable report={report} data={result} />)
    const heads = [...view.container.querySelectorAll('thead th')]
    expect(heads).toHaveLength(2)
    expect(heads[1]?.className).toContain('text-right')
    expect(view.container.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(view.container.querySelector('tfoot')?.textContent).toContain(
      analyticsContent.reports.totals,
    )
  })
})

describe('Analytics skeletons', () => {
  it('overview: the real title and six KPI cells', () => {
    const view = render(<AnalyticsSkeleton />)
    expect(view.getByText(analyticsContent.title)).toBeTruthy()
    expect(view.getByText(analyticsContent.salesOverTime.title)).toBeTruthy()
  })

  it('reports home: the real title', () => {
    const view = render(<ReportsHomeSkeleton />)
    expect(view.getByText(analyticsContent.reports.title)).toBeTruthy()
  })

  it('report: a busy shell with the chart and details cards', () => {
    const view = render(<ReportSkeleton />)
    expect(view.container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(view.container.querySelectorAll('[data-slot="card"]')).toHaveLength(2)
  })
})
