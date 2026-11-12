/** SOURCE OF TRUTH: courier cache fingerprint — WHAT: a short hash of one courier app's saved settings / WHY: courier caches (checkout quotes, the PIN code check) put it in their keys, so saving new credentials or options is a cache miss instead of answers from the old account, and no credential ever sits in a key. */
import { createHash } from 'node:crypto'

/** 16 hex characters of SHA-256 over the settings as stored (`ShippingSettings.providers[id]`). */
export const courierSettingsFingerprint = (settings: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(settings ?? null))
    .digest('hex')
    .slice(0, 16)
