import { z } from 'zod'
import type { Env } from './env'

/**
 * Retired SETTINGS_SECRET value(s), comma-separated: a clean list (trimmed, blanks dropped).
 * Each was once a SETTINGS_SECRET, so each must meet its 16-character minimum; a shorter
 * entry is a paste error and would silently fail to decrypt. Used by the main schema.
 */
export const previousSecrets = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().min(16)))

/** An http(s) URL; the shape NEXT_PUBLIC_WORKER_URL must have. Used by the main schema. */
export const workerUrl = z.url({ protocol: /^https?$/ })

/**
 * SOURCE OF TRUTH KEYWORDS: previousSettingsSecrets, SETTINGS_SECRET_PREVIOUS
 * WHAT:  The retired SETTINGS_SECRET values, validated and split (empty outside a rotation).
 * WHY:   Code that must not require the database URLs (`decryptSecret` in `@commerce/core`)
 *        still reads the key through the schema, never straight from process.env. Read per
 *        call, not cached, so tests can swap the env. Key name only in errors.
 * WHERE: `@commerce/core` secrets; full-env callers read `loadEnv(...).SETTINGS_SECRET_PREVIOUS`.
 */
export function previousSettingsSecrets(
  source: Record<string, string | undefined> = process.env,
): string[] {
  const raw = source.SETTINGS_SECRET_PREVIOUS
  const result = previousSecrets.safeParse(raw?.trim() ? raw : undefined)
  if (!result.success) throw new Error('Invalid environment: SETTINGS_SECRET_PREVIOUS')
  return result.data
}

/**
 * SOURCE OF TRUTH KEYWORDS: workerPublicUrl, NEXT_PUBLIC_WORKER_URL
 * WHAT:  The worker's public origin for server code (webhook and callback addresses shown to
 *        merchants). `http://localhost:<WORKER_PORT>` in development and tests when unset; in
 *        production a missing value throws instead of quietly handing out a localhost address.
 * WHY:   A localhost webhook URL saved into a payment gateway or courier fails silently, days
 *        later. The admin calls this at boot (`instrumentation.ts`) so a bad deploy fails at
 *        once. `inlined` defaults to the literal `process.env.NEXT_PUBLIC_WORKER_URL`, which
 *        Next replaces with the admin image's `--build-arg` value at build time; the
 *        `NEXT_PUBLIC_WORKER_URL` in `env` (runtime) is used when the build had none.
 * WHERE: API payment and app-connect services, admin instrumentation.
 */
export function workerPublicUrl(
  env: Pick<Env, 'NODE_ENV' | 'WORKER_PORT' | 'NEXT_PUBLIC_WORKER_URL'>,
  inlined: string | undefined = process.env.NEXT_PUBLIC_WORKER_URL,
): string {
  const raw = inlined?.trim() ? inlined.trim() : env.NEXT_PUBLIC_WORKER_URL
  if (raw) {
    if (!workerUrl.safeParse(raw).success) {
      throw new Error('Invalid environment: NEXT_PUBLIC_WORKER_URL')
    }
    return raw
  }
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Invalid environment: NEXT_PUBLIC_WORKER_URL (required in production: the worker’s public URL)',
    )
  }
  return `http://localhost:${env.WORKER_PORT}`
}
