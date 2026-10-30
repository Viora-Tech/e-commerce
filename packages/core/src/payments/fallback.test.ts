import { describe, expect, it } from 'vitest'
import { couldNotStart, runWithFallbacks } from './fallback'
import type { OnlineMethodId } from './methods'

type Started = { attemptId: string; status: string; session: unknown; error: string | null }

const opened = (attemptId: string): Started => ({
  attemptId,
  status: 'pending',
  session: { kind: 'client' },
  error: null,
})
const down = (attemptId: string, error = 'gateway down'): Started => ({
  attemptId,
  status: 'failed',
  session: null,
  error,
})

/** A fake runner: each gateway answers as told; records every try and every new attempt. */
function harness(answers: Record<string, 'up' | 'down'>, reopenable = true) {
  const tries: { attemptId: string; gateway: string; methods: OnlineMethodId[] | undefined }[] = []
  const reopened: { from: string; gateway: string }[] = []
  let n = 1
  return {
    tries,
    reopened,
    steps: {
      start: async (attemptId: string, gateway: string, methods: OnlineMethodId[] | undefined) => {
        tries.push({ attemptId, gateway, methods })
        return answers[gateway] === 'up' ? opened(attemptId) : down(attemptId)
      },
      reopen: async (from: string, gateway: string) => {
        if (!reopenable) return null
        reopened.push({ from, gateway })
        n += 1
        return `attempt-${n}`
      },
    },
  }
}

describe('couldNotStart', () => {
  it('is true only when no session reached the shopper and the gateway gave an error', () => {
    expect(couldNotStart(down('a'))).toBe(true)
    expect(couldNotStart(opened('a'))).toBe(false)
    expect(
      couldNotStart({ attemptId: 'a', status: 'failed', session: { kind: 'x' }, error: 'x' }),
    ).toBe(false)
    expect(couldNotStart({ attemptId: 'a', status: 'captured', session: null, error: null })).toBe(
      false,
    )
  })
})

describe('runWithFallbacks', () => {
  it('stops at the first gateway when it opens the payment', async () => {
    const h = harness({ cashfree: 'up', razorpay: 'up' })
    const result = await runWithFallbacks(
      { attemptId: 'attempt-1', provider: 'cashfree' },
      [{ provider: 'razorpay', methods: ['upi'] }],
      h.steps,
    )
    expect(result).toEqual(opened('attempt-1'))
    expect(h.tries.map((t) => t.gateway)).toEqual(['cashfree'])
    expect(h.reopened).toEqual([])
  })

  it('tries the next gateway on a fresh attempt, offering only the methods it was given', async () => {
    const h = harness({ cashfree: 'down', razorpay: 'up' })
    const result = await runWithFallbacks(
      { attemptId: 'attempt-1', provider: 'cashfree' },
      [{ provider: 'razorpay', methods: ['upi'] }],
      h.steps,
    )
    expect(result).toEqual(opened('attempt-2'))
    expect(h.reopened).toEqual([{ from: 'attempt-1', gateway: 'razorpay' }])
    expect(h.tries).toEqual([
      { attemptId: 'attempt-1', gateway: 'cashfree', methods: undefined },
      { attemptId: 'attempt-2', gateway: 'razorpay', methods: ['upi'] },
    ])
  })

  it('walks the whole chain in order and returns the last failure when every gateway is down', async () => {
    const h = harness({ a: 'down', b: 'down', c: 'down' })
    const result = await runWithFallbacks(
      { attemptId: 'attempt-1', provider: 'a' },
      [{ provider: 'b' }, { provider: 'c' }],
      h.steps,
    )
    expect(h.tries.map((t) => t.gateway)).toEqual(['a', 'b', 'c'])
    expect(h.reopened.map((r) => r.from)).toEqual(['attempt-1', 'attempt-2'])
    expect(result).toEqual(down('attempt-3'))
  })

  it('stops when the order can no longer take a new attempt (paid or cancelled meanwhile)', async () => {
    const h = harness({ a: 'down', b: 'up' }, false)
    const result = await runWithFallbacks(
      { attemptId: 'attempt-1', provider: 'a' },
      [{ provider: 'b' }],
      h.steps,
    )
    expect(result).toEqual(down('attempt-1'))
    expect(h.tries.map((t) => t.gateway)).toEqual(['a'])
  })

  it('with no fallbacks behaves like a single start', async () => {
    const h = harness({ a: 'down' })
    const result = await runWithFallbacks({ attemptId: 'attempt-1', provider: 'a' }, [], h.steps)
    expect(result).toEqual(down('attempt-1'))
    expect(h.reopened).toEqual([])
  })
})
