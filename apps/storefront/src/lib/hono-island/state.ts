import 'server-only'
import { loadEnv } from '@commerce/config'
import { type Breaker, type HonoVerdict, honoBreaker } from './route'

/**
 * The Hono service's settings and its breaker, per process, for the proxy (is the service on,
 * is it resting) and the forward route (how did it answer). No Next imports: the proxy reads it.
 */

const DEFAULT_TIMEOUT_MS = 3000

type Env = { url: string | null; timeoutMs: number }
let env: Env | null = null

/** `STOREFRONT_HONO_URL` and `STOREFRONT_HONO_TIMEOUT_MS`, read once per process. */
export function honoEnv(): Env {
  if (env) return env
  try {
    const e = loadEnv(process.env)
    env = {
      url: e.STOREFRONT_HONO_URL?.replace(/\/+$/, '') ?? null,
      timeoutMs: e.STOREFRONT_HONO_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
    }
  } catch {
    // A bad value never takes the storefront down: the service is simply off.
    env = { url: null, timeoutMs: DEFAULT_TIMEOUT_MS }
  }
  return env
}

// On `globalThis`: the proxy and the forward route are separate bundles in one process.
const STATE_KEY = Symbol.for('commerce.hono-breaker')
function breakerState(): Breaker {
  const g = globalThis as unknown as Record<symbol, Breaker | undefined>
  g[STATE_KEY] ??= { failures: 0, restUntil: 0 }
  return g[STATE_KEY]
}

/** The breaker is open: product pages stay on Next for now. */
export const honoResting = (): boolean => honoBreaker(breakerState(), Date.now()).resting()

/** Counts one answer toward the breaker. */
export const noteHono = (verdict: HonoVerdict): void =>
  honoBreaker(breakerState(), Date.now()).note(verdict)
