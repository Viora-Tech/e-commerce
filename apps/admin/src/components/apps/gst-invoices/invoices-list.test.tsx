// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { appsContent } from '@/data/apps'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { tableContent } from '@/data/table'
import InvoicesList from './invoices-list'

const copy = gstInvoicesContent.list
const loadingLabel = tableContent.loading(copy.title.toLowerCase())

type ListPage = { rows: unknown[]; hasMore: boolean }
let answer: (page: ListPage) => void = () => undefined
let fail: (error: Error) => void = () => undefined
const list = vi.fn(
  () =>
    new Promise<ListPage>((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
)

vi.mock('@/lib/api-client', () => ({ api: { gstInvoices: { list: () => list() } } }))
vi.mock('./gst-number-picker', () => ({ default: () => null }))

describe('InvoicesList', () => {
  it('shows skeleton rows until the first response, then the empty message', async () => {
    vi.useFakeTimers()
    render(<InvoicesList />)
    expect(screen.queryByText(copy.empty)).toBeNull()
    expect(screen.getByLabelText(loadingLabel)).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByText(copy.empty)).toBeNull()

    await act(async () => {
      answer({ rows: [], hasMore: false })
    })
    expect(screen.getByText(copy.empty)).toBeTruthy()
    expect(screen.queryByLabelText(loadingLabel)).toBeNull()
    vi.useRealTimers()
  })

  it('says the invoices could not load, not "nothing issued", and Try again reads again', async () => {
    vi.useFakeTimers()
    list.mockClear()
    render(<InvoicesList />)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    await act(async () => {
      fail(new Error('down'))
    })
    expect(screen.getByText(appsContent.couldNotLoad.invoices)).toBeTruthy()
    expect(screen.queryByText(copy.empty)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText(loadingLabel)).toBeTruthy()
    vi.useRealTimers()
  })
})
