// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import StatusLabel from '@/components/status/status-label'
import { ordersContent } from '@/data/orders'

describe('StatusChip', () => {
  it('draws the leading dot by default', () => {
    render(<StatusChip tone="success">Paid</StatusChip>)
    const chip = screen.getByText('Paid')
    expect(chip.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(chip.className).toContain('text-success')
  })

  it('leaves the dot out for plain labels and tags', () => {
    render(<StatusChip dot={false}>Required</StatusChip>)
    expect(screen.getByText('Required').querySelector('[aria-hidden="true"]')).toBeNull()
  })
})

describe('StatusLabel', () => {
  it('renders the dot variant as a StatusChip dot in the size it was given', () => {
    render(<StatusLabel kind="orderPayment" value="paid" size="sm" />)
    const label = screen.getByText(ordersContent.paymentStatus.paid)
    expect(label.className).toContain('text-caption')
    expect(label.className).not.toContain('text-period')
    expect(label.querySelector('.bg-success')).not.toBeNull()
  })
})

describe('EmptyState inline', () => {
  it('shows the one line of words in the inline row', () => {
    render(<EmptyState variant="inline" body="No returns yet" className="mt-3" />)
    const row = screen.getByText('No returns yet').closest('div.mt-3')
    expect(row?.className).toContain('rounded-lg')
  })
})
