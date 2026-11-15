// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { appsContent } from '@/data/apps'
import { gstReturnsContent } from '@/data/gst-invoices'
import PeriodsTable from './periods-table'

const p = gstReturnsContent.periods
let fail: (error: Error) => void = () => undefined

vi.mock('@/lib/api-client', () => ({
  api: {
    gstInvoices: {
      periods: {
        list: () =>
          new Promise((_resolve, reject) => {
            fail = reject
          }),
      },
    },
  },
}))

describe('PeriodsTable', () => {
  it('shows no month as Open (and no Mark filed) until the marks are read', async () => {
    render(<PeriodsTable gst={undefined} selected="" onSelect={() => {}} onChanged={() => {}} />)
    expect(screen.queryByText(p.open)).toBeNull()
    expect(screen.queryByRole('button', { name: p.markFiled })).toBeNull()
    expect(screen.getByLabelText(p.title)).toBeTruthy()

    await act(async () => {
      fail(new Error('down'))
    })
    expect(screen.getByText(appsContent.couldNotLoad.summary)).toBeTruthy()
    expect(screen.queryByRole('button', { name: p.markFiled })).toBeNull()
  })
})
