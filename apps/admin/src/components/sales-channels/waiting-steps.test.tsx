// @vitest-environment jsdom
/** SOURCE OF TRUTH: "Waiting for approval" next steps — WHAT: steps while sign-in is off, Connect now once it is on / WHY: a request waited forever for an approval nobody gives (owner, 14 Nov 2026) */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { salesChannelsContent } from '@/data/sales-channels'
import WaitingSteps from './waiting-steps'

const copy = salesChannelsContent.socialPage.waiting

describe('WaitingSteps', () => {
  it('lists what happens next while sign-in is not switched on', () => {
    render(<WaitingSteps partner="Meta Commerce Manager" connectNow={false} onConnect={vi.fn()} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: copy.connectNow })).toBeNull()
  })

  it('offers Connect now once sign-in is on', () => {
    const onConnect = vi.fn()
    render(<WaitingSteps partner="Google Merchant Center" connectNow onConnect={onConnect} />)
    expect(screen.getByText(copy.ready('Google Merchant Center'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: copy.connectNow }))
    expect(onConnect).toHaveBeenCalledOnce()
  })
})
