import { requestContext } from './request-context'

/**
 * `React.cache` as the storefront's modules rely on it in Next: one result per request for the
 * same arguments (`requestScope`, `storeStamp`, the market's catalog...). Outside a React server
 * render React's own `cache` memoises nothing, so the preload (`./preload.ts`) puts this one in
 * its place. Keyed like React's: primitives by value; a call with an object argument is not
 * memoised (React keys those by identity, which a fresh object never repeats anyway).
 */
export function requestCache<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return (...args: A): R => {
    const ctx = requestContext.getStore()
    if (
      !ctx ||
      args.some((a) => a !== null && (typeof a === 'object' || typeof a === 'function'))
    ) {
      return fn(...args)
    }
    let calls = ctx.memo.get(fn)
    if (!calls) {
      calls = new Map()
      ctx.memo.set(fn, calls)
    }
    const key = args.map((a) => `${typeof a}:${String(a)}`).join('\u0000')
    if (calls.has(key)) return calls.get(key) as R
    const value = fn(...args)
    calls.set(key, value)
    return value
  }
}
