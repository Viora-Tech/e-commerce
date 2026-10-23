// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const query = vi.fn()
vi.mock('@/lib/api-client', () => ({ api: { analytics: { query } } }))

const { CHECK_DELAY_MS, useQueryRunner } = await import('./use-query-runner')

/** A server answer whose one row is keyed by `label`, so tests can tell answers apart. */
const answer = (label: string) => ({
  ok: true as const,
  report: { metric: 'orders' },
  result: { rows: [{ key: label, values: {}, previous: null }] },
  ms: 1,
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  query.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useQueryRunner', () => {
  it('checks after typing pauses and runs a valid query once', async () => {
    query.mockResolvedValue(answer('one'))
    const { result } = renderHook(() => useQueryRunner('FROM sales SHOW orders', null))
    act(() => result.current.schedule('FROM sales SHOW net_sale'))
    act(() => result.current.schedule('FROM sales SHOW net_sales'))
    expect(query).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(CHECK_DELAY_MS)
    })
    expect(query).toHaveBeenCalledTimes(1)
    expect(result.current.checked.result.ok).toBe(true)
    // The same query with other spacing does not run again.
    await act(async () => result.current.checkNow('from sales\n  show net_sales'))
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('shows a parse error and keeps the last good query for the controls', async () => {
    const { result } = renderHook(() => useQueryRunner('FROM sales SHOW orders', null))
    act(() => result.current.checkNow('FROM sales SHOW nope'))
    expect(result.current.checked.result.ok).toBe(false)
    expect(result.current.good.show).toEqual(['orders'])
    expect(query).not.toHaveBeenCalled()
  })

  it('drops an older answer that arrives after a newer one', async () => {
    const slow = deferred<ReturnType<typeof answer>>()
    const fast = deferred<ReturnType<typeof answer>>()
    query.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise)
    const { result } = renderHook(() => useQueryRunner('FROM sales SHOW orders', null))
    act(() => result.current.checkNow('FROM sales SHOW net_sales'))
    act(() => result.current.checkNow('FROM sales SHOW taxes'))
    await act(async () => fast.resolve(answer('new')))
    await act(async () => slow.resolve(answer('old')))
    expect(result.current.ran?.result.rows[0]?.key).toBe('new')
    expect(result.current.busy).toBe(false)
  })

  it('Run sends the query again even when it has not changed', async () => {
    query.mockResolvedValue(answer('one'))
    const { result } = renderHook(() => useQueryRunner('FROM sales SHOW orders', null))
    await act(async () => result.current.runNow('FROM sales SHOW orders'))
    await act(async () => result.current.runNow('FROM sales SHOW orders'))
    expect(query).toHaveBeenCalledTimes(2)
  })
})
