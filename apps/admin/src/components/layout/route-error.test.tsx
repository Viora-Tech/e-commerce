// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import RouteError from '@/components/layout/route-error'
import { statesContent } from '@/data/states'
import { FORBIDDEN_DIGEST } from '@/lib/forbidden'

vi.mock('@/lib/browser-errors', () => ({ reportBrowserError: vi.fn() }))
vi.spyOn(console, 'error').mockImplementation(() => undefined)

describe('RouteError', () => {
  it('says "You do not have access" for a FORBIDDEN server render, with no retry', () => {
    const error = Object.assign(new Error('An error occurred'), { digest: FORBIDDEN_DIGEST })
    render(<RouteError error={error} reset={vi.fn()} />)
    expect(screen.getByText(statesContent.noAccess.heading)).toBeTruthy()
    expect(screen.queryByText(statesContent.error.retry)).toBeNull()
  })

  it('says something went wrong, with Try again, for any other failure', () => {
    render(<RouteError error={Object.assign(new Error('boom'), { digest: '1' })} reset={vi.fn()} />)
    expect(screen.getByText(statesContent.error.heading)).toBeTruthy()
    expect(screen.getByText(statesContent.error.retry)).toBeTruthy()
  })
})
