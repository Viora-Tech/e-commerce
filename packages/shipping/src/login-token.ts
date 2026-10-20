import { CourierError } from './courier-error'

/**
 * A bearer token a courier issues for a username/password login (Xpressbees, Ekart), cached in
 * the adapter instance and fetched again shortly before it lapses. Concurrent calls share one
 * login. `invalidate()` drops it, for the one retry an adapter makes after a 401 (the courier
 * revoked the token early).
 *
 * In-memory only, on purpose: the token is never written to the database, so a leaked backup
 * holds the encrypted password and nothing that works without it.
 */
export class LoginTokenCache {
  private token: string | undefined
  private expiresAt = 0
  private pending: Promise<string> | undefined

  constructor(
    private readonly login: () => Promise<{ token: string; lifetimeMs: number }>,
    /** Refresh this long before the courier's stated expiry. */
    private readonly marginMs = 5 * 60 * 1000,
  ) {}

  async get(): Promise<string> {
    if (this.token && Date.now() < this.expiresAt - this.marginMs) return this.token
    if (!this.pending) {
      this.pending = this.login()
        .then(({ token, lifetimeMs }) => {
          this.token = token
          this.expiresAt = Date.now() + lifetimeMs
          return token
        })
        .finally(() => {
          this.pending = undefined
        })
    }
    return this.pending
  }

  invalidate(): void {
    this.token = undefined
    this.expiresAt = 0
  }

  /** Runs `call` with a token; on an `auth` failure logs in again once and retries. */
  async withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
    try {
      return await call(await this.get())
    } catch (error) {
      if (!(error instanceof CourierError) || error.kind !== 'auth' || !this.token) throw error
      this.invalidate()
      return call(await this.get())
    }
  }
}
