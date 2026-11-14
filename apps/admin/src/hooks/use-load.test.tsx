// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useLoad } from './use-load'

describe('useLoad', () => {
  it('starts loading, then holds the answer', async () => {
    const { result } = renderHook(() => useLoad(() => Promise.resolve(42)))
    expect(result.current).toMatchObject({ data: null, failed: false, loading: true })
    await waitFor(() => expect(result.current.data).toBe(42))
    expect(result.current).toMatchObject({ failed: false, loading: false })
  })

  it('says error on a plain failure and loads again on retry', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useLoad(load))
    await waitFor(() => expect(result.current.failed).toBe('error'))
    expect(result.current.loading).toBe(false)
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(result.current.failed).toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("says no-access when the member's role does not allow the read", async () => {
    const { result } = renderHook(() =>
      useLoad(() => Promise.reject(Object.assign(new Error('no'), { code: 'FORBIDDEN' }))),
    )
    await waitFor(() => expect(result.current.failed).toBe('no-access'))
  })

  it('drops an answer that arrives after unmount', async () => {
    let resolve: (v: number) => void = () => undefined
    const { result, unmount } = renderHook(() =>
      useLoad(() => new Promise<number>((r) => (resolve = r))),
    )
    unmount()
    resolve(1)
    await Promise.resolve()
    expect(result.current.data).toBeNull()
  })
})
