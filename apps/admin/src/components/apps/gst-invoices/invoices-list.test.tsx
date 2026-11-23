// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { describe, expect, it, vi } from 'vitest'
import { appsContent } from '@/data/apps'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstListFiltersContent } from '@/data/gst-list-filters'
import { tableContent } from '@/data/table'
import InvoicesList from './invoices-list'

const copy = gstInvoicesContent.list
const loadingLabel = tableContent.loading(gstListFiltersContent.invoiceResource.plural)

type ListPage = { rows: unknown[]; hasMore: boolean; total: number }
let answer: (page: ListPage) => void = () => undefined
let fail: (error: Error) => void = () => undefined
const list = vi.fn(
  (_input: unknown) =>
    new Promise<ListPage>((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
)

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/api-client', () => ({
  api: {
    gstInvoices: {
      list: (input: unknown) => list(input),
      gstNumbers: () => Promise.resolve({ numbers: [], defaultId: null }),
    },
  },
}))

const renderAt = (search = '') =>
  render(
    <NuqsTestingAdapter searchParams={search}>
      <InvoicesList />
    </NuqsTestingAdapter>,
  )

describe('InvoicesList', () => {
  it('shows skeleton rows until the first response, then the empty message', async () => {
    renderAt()
    expect(screen.queryByText(copy.empty)).toBeNull()
    expect(screen.getByLabelText(loadingLabel)).toBeTruthy()

    await act(async () => {
      answer({ rows: [], hasMore: false, total: 0 })
    })
    expect(screen.getByText(copy.empty)).toBeTruthy()
    expect(screen.queryByLabelText(loadingLabel)).toBeNull()
  })

  it('says the invoices could not load, not "nothing issued", and Try again reads again', async () => {
    list.mockClear()
    renderAt()
    await act(async () => {
      fail(new Error('down'))
    })
    expect(screen.getByText(appsContent.couldNotLoad.invoices)).toBeTruthy()
    expect(screen.queryByText(copy.empty)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await act(async () => undefined)
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText(loadingLabel)).toBeTruthy()
  })

  it('reads search, view, filters, sort and page from the URL', async () => {
    list.mockClear()
    renderAt('?query=1042&tab=credit_note&source=external&status=issued&sort=total.asc&page=2')
    await act(async () => undefined)
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: '1042',
        kind: ['credit_note'],
        source: 'external',
        status: 'issued',
        sort: { by: 'total', desc: false },
        page: 2,
      }),
    )
  })
})
