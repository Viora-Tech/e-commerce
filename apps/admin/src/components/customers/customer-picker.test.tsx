// @vitest-environment jsdom
/** SOURCE OF TRUTH: CustomerPicker — WHAT: one customer picker for merge/change-customer (list) and gift cards (dropdown) / WHY: design audit step 16 merged two pickers that did the same search (14 Nov 2026) */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { customerPickerContent as copy } from '@/data/customer-merge'
import CustomerPicker, { type PickedCustomer } from './customer-picker'

const list = vi.fn()

vi.mock('@/lib/api-client', () => ({
  api: { customers: { list: (input: unknown) => list(input) } },
}))

const ASHA = {
  id: 'c1',
  name: 'Asha Rao',
  email: 'asha@example.com',
  phone: '+919800000000',
  orderCount: 2,
} as PickedCustomer
const BILAL = {
  ...ASHA,
  id: 'c2',
  name: 'Bilal Khan',
  email: 'bilal@example.com',
} as PickedCustomer

afterEach(() => {
  cleanup()
  list.mockReset()
})

describe('CustomerPicker (list)', () => {
  it('waits for 2 letters, leaves out the excluded customer and picks one', async () => {
    list.mockResolvedValue({ items: [ASHA, BILAL] })
    const onPick = vi.fn()
    render(<CustomerPicker id="t" exceptId="c2" value={null} onPick={onPick} />)
    const box = screen.getByLabelText(copy.label)
    fireEvent.change(box, { target: { value: 'a' } })
    expect(screen.getByText(copy.hint)).toBeTruthy()
    fireEvent.change(box, { target: { value: 'as' } })
    const row = await screen.findByRole('button', { name: /Asha Rao/ })
    expect(screen.queryByRole('button', { name: /Bilal Khan/ })).toBeNull()
    expect(list).toHaveBeenCalledWith({ page: 1, perPage: 8, search: 'as' })
    fireEvent.click(row)
    expect(onPick).toHaveBeenCalledWith(ASHA)
  })
})

describe('CustomerPicker (dropdown)', () => {
  it('lists recent customers on focus and picks one', async () => {
    list.mockResolvedValue({ items: [ASHA] })
    const onChange = vi.fn()
    render(<CustomerPicker mode="dropdown" value={null} onChange={onChange} />)
    fireEvent.focus(screen.getByRole('combobox'))
    const row = await screen.findByRole('button', { name: /Asha Rao/ })
    expect(list).toHaveBeenCalledWith({ page: 1, perPage: 6, search: undefined })
    fireEvent.click(row)
    expect(onChange).toHaveBeenCalledWith(ASHA)
  })

  it('says when the lookup failed', async () => {
    list.mockRejectedValue(new Error('down'))
    render(<CustomerPicker mode="dropdown" value={null} onChange={vi.fn()} />)
    fireEvent.focus(screen.getByRole('combobox'))
    await waitFor(() => expect(screen.getByText(copy.lookup.failed)).toBeTruthy())
  })

  it('shows the pick as a removable row', () => {
    const onChange = vi.fn()
    render(<CustomerPicker mode="dropdown" value={ASHA} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: copy.lookup.clear }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
