// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const info = vi.fn()
const error = vi.fn(() => 'error-toast')
vi.mock('sonner', () => ({ toast: { info, error } }))

afterEach(() => {
  vi.useRealTimers()
  info.mockClear()
  error.mockClear()
})

describe('showApprovalNotice', () => {
  it("shows one notice and holds back the page's failure toast for the same call", async () => {
    const { showApprovalNotice } = await import('./approval-notice')
    const { toast } = await import('sonner')
    vi.useFakeTimers()
    showApprovalNotice('Sent for approval.')
    expect(info).toHaveBeenCalledWith('Sent for approval.', { id: 'approval-queued' })
    toast.error('Could not switch. Try again.')
    expect(error).not.toHaveBeenCalled()
    // A later, unrelated failure still shows.
    vi.advanceTimersByTime(3000)
    toast.error('Could not save. Try again.')
    expect(error).toHaveBeenCalledWith('Could not save. Try again.', undefined)
  })
})
