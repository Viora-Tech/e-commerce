// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appsContent } from '@/data/apps'
import { statesContent } from '@/data/states'
import ConnectPage from './connect-page'

let fail: (error: unknown) => void = () => undefined
let answer: (value: null) => void = () => undefined
const connection = vi.fn(
  () =>
    new Promise<null>((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
)

vi.mock('@/lib/api-client', () => ({
  api: { shopifyImport: { connection: () => connection(), preflight: vi.fn() } },
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('./connect-form', () => ({ default: () => <p>connect form</p> }))
vi.mock('./scopes-card', () => ({ default: () => null }))
vi.mock('./preflight-card', () => ({ default: () => null }))

describe('Shopify import ConnectPage', () => {
  beforeEach(() => {
    connection.mockClear()
  })

  it('says the connection could not load (not the connect form), and Try again reads again', async () => {
    render(<ConnectPage />)
    await act(async () => {
      fail(new Error('down'))
    })
    expect(screen.getByText(appsContent.couldNotLoad.connection)).toBeTruthy()
    expect(screen.queryByText('connect form')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: statesContent.error.retry }))
    expect(connection).toHaveBeenCalledTimes(2)
    await act(async () => {
      answer(null)
    })
    expect(screen.getByText('connect form')).toBeTruthy()
  })

  it('shows no access for a role that cannot read the connection', async () => {
    render(<ConnectPage />)
    await act(async () => {
      fail({ code: 'FORBIDDEN' })
    })
    expect(screen.getByText(statesContent.noAccess.heading)).toBeTruthy()
    expect(screen.queryByRole('button', { name: statesContent.error.retry })).toBeNull()
  })
})
