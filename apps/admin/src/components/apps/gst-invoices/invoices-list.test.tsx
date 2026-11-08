// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { tableContent } from '@/data/table'
import InvoicesList from './invoices-list'

const copy = gstInvoicesContent.list
const loadingLabel = tableContent.loading(copy.title.toLowerCase())

type ListPage = { rows: unknown[]; hasMore: boolean }
let answer: (page: ListPage) => void = () => undefined

vi.mock('@/lib/api-client', () => ({
  api: {
    gstInvoices: {
      list: () =>
        new Promise<ListPage>((resolve) => {
          answer = resolve
        }),
    },
  },
}))
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
})
