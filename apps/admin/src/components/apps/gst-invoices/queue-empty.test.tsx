// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gstQueueEmptyContent as copy, gstInvoicesContent } from '@/data/gst-invoices'
import { routes } from '@/lib/routes'
import ChoiceField from './choice-field'
import QueueEmpty from './queue-empty'

describe('QueueEmpty', () => {
  it('says what the queue holds, how orders arrive and where to change it', () => {
    render(<QueueEmpty issueOn="fulfilment" filtered={false} />)
    expect(screen.getByText(copy.heading)).toBeTruthy()
    expect(screen.getByText(new RegExp(copy.when.fulfilment))).toBeTruthy()
    expect(screen.getByText(copy.settings).closest('a')?.getAttribute('href')).toBe(
      routes.apps.page('gst-invoices', 'settings'),
    )
    expect(screen.getByText(copy.orders).closest('a')?.getAttribute('href')).toBe(
      routes.orders.list(),
    )
  })

  it('asks to clear the dates when a range hides the queue', () => {
    render(<QueueEmpty issueOn="payment" filtered />)
    expect(screen.getByText(copy.filtered)).toBeTruthy()
    expect(screen.queryByText(copy.heading)).toBeNull()
  })
})

describe('Invoices list type filter', () => {
  // "All documents" printed twice: once as the field label, once as the selected option.
  it('shows "All documents" once', () => {
    const list = gstInvoicesContent.list
    render(
      <ChoiceField
        id="inv-kind"
        label={list.kindFilter}
        hideLabel
        value="all"
        options={[{ value: 'all', label: list.all }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getAllByText(list.all)).toHaveLength(1)
    expect(screen.getByText(list.kindFilter).className).toContain('sr-only')
  })
})
