import { COURIER_TIMEOUT_MS, CourierError } from '@commerce/shipping'
import { BLUEDART_PATHS, bluedartError } from './api'

/**
 * Blue Dart's API Gateway transport: the JWT minted from the app's Client ID + secret (cached
 * per app until shortly before it expires, minted again on a 401), and one call that turns
 * Blue Dart's answers and failures into CourierErrors. The provider (./bluedart.ts) only
 * decides what to ask.
 */

/** Mint a fresh token this long before the old one expires. */
const TOKEN_MARGIN_MS = 60_000
/** When the JWT has no readable `exp`: Blue Dart's tokens are commonly valid for a day. */
const TOKEN_FALLBACK_MS = 30 * 60_000

/** One JWT per gateway app, shared by every provider instance built from the same keys. */
const tokens = new Map<string, { token: string; expiresAt: number }>()

/** A JWT's `exp` claim in ms, or null when it is not a readable JWT. */
function jwtExpiry(token: string): number | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const exp = (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: number })
      .exp
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

export type GatewayOptions = {
  baseUrl: string
  clientId: string
  clientSecret: string
  fetchImpl: typeof fetch
}

export class BluedartGateway {
  private readonly id = 'bluedart'

  constructor(private readonly config: GatewayOptions) {}

  private get baseUrl() {
    return this.config.baseUrl
  }

  private get fetchImpl() {
    return this.config.fetchImpl
  }

  private get tokenKey() {
    return `${this.baseUrl}|${this.config.clientId}`
  }

  /** A fetch that maps transport failures to CourierError and never puts the URL in a message. */
  private async raw(url: string, init: RequestInit, timeoutMs = COURIER_TIMEOUT_MS) {
    try {
      return await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new CourierError(
          'timeout',
          this.id,
          `Blue Dart did not answer within ${timeoutMs}ms.`,
          {
            cause: error,
          },
        )
      }
      throw new CourierError('unavailable', this.id, 'Could not reach Blue Dart.', { cause: error })
    }
  }

  private async token(): Promise<string> {
    const cached = tokens.get(this.tokenKey)
    if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) return cached.token
    const res = await this.raw(`${this.baseUrl}${BLUEDART_PATHS.token}`, {
      headers: {
        ClientID: this.config.clientId,
        clientSecret: this.config.clientSecret,
        Accept: 'application/json',
      },
    })
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      throw new CourierError('auth', this.id, 'Blue Dart rejected the Client ID or secret.', {
        status: res.status,
      })
    }
    if (!res.ok) {
      throw new CourierError('unavailable', this.id, `Blue Dart returned HTTP ${res.status}.`, {
        status: res.status,
      })
    }
    const text = await res.text()
    let token = ''
    try {
      const body = JSON.parse(text) as { JWTToken?: string } | string
      token = typeof body === 'string' ? body : (body.JWTToken ?? '')
    } catch {
      token = text.trim()
    }
    if (!token) throw new CourierError('bad_response', this.id, 'Blue Dart returned no token.')
    tokens.set(this.tokenKey, {
      token,
      expiresAt: jwtExpiry(token) ?? Date.now() + TOKEN_FALLBACK_MS,
    })
    return token
  }

  /**
   * One authenticated call. A 401/403 drops the cached token and retries once (it may have
   * been revoked early); a 4xx with Blue Dart's own reason becomes a `rejected` error the
   * merchant can act on, rather than a bare "HTTP 400".
   */
  async call<T>(
    path: string,
    init: { method?: 'GET' | 'POST'; body?: unknown; timeoutMs?: number } = {},
    retried = false,
  ): Promise<T> {
    const res = await this.raw(
      `${this.baseUrl}${path}`,
      {
        method: init.method ?? 'POST',
        headers: {
          JWTToken: await this.token(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      },
      init.timeoutMs,
    )
    if ((res.status === 401 || res.status === 403) && !retried) {
      tokens.delete(this.tokenKey)
      return this.call<T>(path, init, true)
    }
    if (res.status === 401 || res.status === 403) {
      throw new CourierError('auth', this.id, 'Blue Dart rejected the credentials.', {
        status: res.status,
      })
    }
    if (res.status === 429) {
      throw new CourierError('rate_limited', this.id, 'Blue Dart is rate limiting us.', {
        status: 429,
      })
    }
    const text = await res.text()
    let body: unknown
    try {
      body = text ? JSON.parse(text) : {}
    } catch (error) {
      if (!res.ok) {
        throw new CourierError('unavailable', this.id, `Blue Dart returned HTTP ${res.status}.`, {
          status: res.status,
        })
      }
      throw new CourierError(
        'bad_response',
        this.id,
        `Blue Dart returned a non-JSON body (${text.slice(0, 120)}).`,
        { cause: error },
      )
    }
    if (!res.ok) {
      const reason = bluedartError(body)
      if (res.status < 500 && reason) throw new CourierError('rejected', this.id, reason)
      throw new CourierError('unavailable', this.id, `Blue Dart returned HTTP ${res.status}.`, {
        status: res.status,
      })
    }
    return body as T
  }
}
