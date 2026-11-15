// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { statesContent } from '@/data/states'
import LoadFailedState from './load-failed-state'

describe('LoadFailedState', () => {
  it('names what did not load and offers Try again', () => {
    const retry = vi.fn()
    render(<LoadFailedState heading="Could not load the queue" onRetry={retry} />)
    expect(screen.getByText('Could not load the queue')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: statesContent.error.retry }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('shows no access (and no retry) for a FORBIDDEN read', () => {
    render(
      <LoadFailedState
        size="page"
        heading="Could not load the queue"
        failed="no-access"
        onRetry={() => {}}
      />,
    )
    expect(screen.queryByText('Could not load the queue')).toBeNull()
    expect(screen.getByText(statesContent.noAccess.heading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: statesContent.error.retry })).toBeNull()
  })
})
