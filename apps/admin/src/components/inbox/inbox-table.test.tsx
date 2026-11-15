// @vitest-environment jsdom
/** SOURCE OF TRUTH: Inbox list tables — WHAT: one card and header while loading, failed and loaded / WHY: a failed read showed "Nobody is blocked" or kept old rows silently (design audit page pass 13, 14 Nov 2026) */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { statesContent } from '@/data/states'
import InboxTable from './inbox-table'

const COLUMNS = [{ label: 'Shortcut' }, { label: 'Title' }]

const heads = (container: HTMLElement) =>
  [...container.querySelectorAll('thead th')].map((th) => th.textContent)

describe('InboxTable', () => {
  it('draws the real header over placeholder rows while it loads', () => {
    const { container } = render(
      <InboxTable
        heading="Your quick replies"
        columns={COLUMNS}
        loading
        failed={false}
        failedHeading="Could not load quick replies"
        onRetry={vi.fn()}
        after={<p>empty</p>}
      />,
    )
    expect(heads(container)).toEqual(['Shortcut', 'Title'])
    expect(container.querySelectorAll('tbody tr[aria-busy="true"]').length).toBe(3)
    expect(screen.queryByText('empty')).toBeNull()
  })

  it('says the read failed under the same header, with Try again, even over old rows', () => {
    const onRetry = vi.fn()
    const { container } = render(
      <InboxTable
        heading="Your quick replies"
        columns={COLUMNS}
        loading={false}
        failed="error"
        failedHeading="Could not load quick replies"
        onRetry={onRetry}
      >
        <tr>
          <td>old row</td>
        </tr>
      </InboxTable>,
    )
    expect(heads(container)).toEqual(['Shortcut', 'Title'])
    expect(screen.getByText('Could not load quick replies')).toBeTruthy()
    expect(screen.queryByText('old row')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: statesContent.error.retry }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('shows no-access without a retry for a role that may not read it', () => {
    render(
      <InboxTable
        heading="Blocked senders"
        columns={COLUMNS}
        loading={false}
        failed="no-access"
        failedHeading="Could not load blocked senders"
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText(statesContent.noAccess.heading)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws the rows and the empty state once loaded', () => {
    render(
      <InboxTable
        heading="Your quick replies"
        columns={COLUMNS}
        loading={false}
        failed={false}
        failedHeading="Could not load quick replies"
        onRetry={vi.fn()}
        after={<p>empty</p>}
      >
        <tr>
          <td>/cod</td>
        </tr>
      </InboxTable>,
    )
    expect(screen.getByText('/cod')).toBeTruthy()
    expect(screen.getByText('empty')).toBeTruthy()
  })
})
