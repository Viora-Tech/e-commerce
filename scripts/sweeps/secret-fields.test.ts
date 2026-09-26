/**
 * Sweep: provider config fields (`ProviderField[]` in payments/shipping/notifications/
 * storage factories) must declare `secret: true` on anything whose name looks like a
 * credential. Two checks:
 *
 *  1. Static: no `{ key: '...', label: '...' }` object whose `key` matches
 *     `LOOKS_SECRET` (secret, token, password) is missing `secret: true`. Deliberately
 *     doesn't blind-match "key" or "pin" as substrings — see `LOOKS_SECRET`'s comment
 *     in `walk.ts` for why (keyId/accessKeyId are public, pincode isn't a credential).
 *     This is the source of truth the admin form and the encrypt/mask logic both read
 *     (`packages/core/src/settings/secrets.ts`) — the name regex there is only a
 *     safety net and must never be the ONLY thing catching a real secret.
 *  2. Round-trip: every real connector factory's flagged fields actually come back
 *     encrypted after `encryptProviderSettings` and decrypt to the original value.
 *
 * Not a ratchet with an allow-list: every field in the repo is already flagged
 * correctly, so any violation here is new and should just be fixed.
 */

import { decryptSecret, encryptProviderSettings, isEncryptedSecret } from '@commerce/core'
import { sesFactory } from '@commerce/notifications-ses'
import { whatsappFactory } from '@commerce/notifications-whatsapp'
import { cashfreeFactory } from '@commerce/payments-cashfree'
import { decentroFactory } from '@commerce/payments-decentro'
import { razorpayFactory } from '@commerce/payments-razorpay'
import { delhiveryFactory } from '@commerce/shipping-delhivery'
import { rapidshypFactory } from '@commerce/shipping-rapidshyp'
import { shiprocketFactory } from '@commerce/shipping-shiprocket'
import { r2Factory } from '@commerce/storage-r2'
import { s3Factory } from '@commerce/storage-s3'
import { describe, expect, it } from 'vitest'
import { findProviderFieldViolations, listFiles, loadSourceFile, toRel } from './walk'

async function findStaticViolations(): Promise<string[]> {
  const files = await listFiles(['apps', 'packages', 'scripts'], { includeTests: false })
  const out: string[] = []
  for (const f of files) {
    const sf = loadSourceFile(f)
    for (const v of findProviderFieldViolations(sf)) {
      out.push(`${toRel(f)}:${v.line} field "${v.key}" looks secret but has no secret: true`)
    }
  }
  return out
}

describe('sweep: secret-fields', () => {
  it('every secret-looking provider field is flagged secret: true', async () => {
    const violations = await findStaticViolations()
    expect(violations, violations.join('\n')).toEqual([])
  })

  it('round-trips every real connector factory: flagged fields encrypt and decrypt correctly', () => {
    const factories = [
      razorpayFactory,
      cashfreeFactory,
      decentroFactory,
      delhiveryFactory,
      shiprocketFactory,
      rapidshypFactory,
      sesFactory,
      whatsappFactory,
      r2Factory,
      s3Factory,
    ]
    const secret = 'test-only-settings-secret-value'

    for (const factory of factories) {
      const providerId = factory.id
      const plain: Record<string, string> = {}
      for (const field of factory.fields) {
        plain[field.key] = field.type === 'boolean' ? 'true' : `dummy-${field.key}-value`
      }

      const settings = { enabled: [providerId], providers: { [providerId]: plain } }
      const encrypted = encryptProviderSettings(settings, secret, (id) =>
        id === providerId ? factory.fields : undefined,
      )

      for (const field of factory.fields) {
        const storedValue = encrypted.providers[providerId]?.[field.key]
        expect(storedValue, `${providerId}.${field.key}`).toBeDefined()
        if (field.secret) {
          expect(
            isEncryptedSecret(storedValue),
            `${providerId}.${field.key} should be encrypted`,
          ).toBe(true)
          expect(decryptSecret(storedValue as string, secret)).toBe(plain[field.key])
        } else {
          expect(storedValue).toBe(plain[field.key])
        }
      }
    }
  })
})
