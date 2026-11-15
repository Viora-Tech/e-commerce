// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { statesContent } from '@/data/states'
import { didFail, loadFailure } from '@/lib/load-failure'
import ServerLoadFailed from './server-load-failed'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

describe('ServerLoadFailed', () => {
  it('says what did not load and asks the server again on Try again', () => {
    render(<ServerLoadFailed failed="error" heading="Could not load themes" />)
    expect(screen.getByText('Could not load themes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: statesContent.error.retry }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('shows no access, with no retry, when the role does not allow the read', () => {
    render(<ServerLoadFailed failed="no-access" heading="Could not load themes" />)
    expect(screen.getByText(statesContent.noAccess.heading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: statesContent.error.retry })).toBeNull()
  })
})

describe('loadFailure', () => {
  it('maps FORBIDDEN to no-access and anything else to error', () => {
    expect(loadFailure({ code: 'FORBIDDEN' })).toEqual({ failed: 'no-access' })
    expect(loadFailure(new Error('boom'))).toEqual({ failed: 'error' })
    expect(didFail(loadFailure(null))).toBe(true)
    expect(didFail([])).toBe(false)
    expect(didFail(null)).toBe(false)
  })
})
