/** SOURCE OF TRUTH: fetchPublicLabel — WHAT: a courier's public label link read server-side, SSRF-guarded and capped / WHY: shared by label sheets and the single Print label's fallback */
import { readCapped, safeFetch } from '@commerce/core/safe-fetch'

/** One courier label's file at most (a label PDF is tens of KB). */
const LABEL_MAX_BYTES = 10 * 1024 * 1024
const LABEL_FETCH_TIMEOUT_MS = 15_000
/** A courier's public label link (Shiprocket, Xpressbees…), fetched with the SSRF guard. */
export async function fetchPublicLabel(url: string): Promise<Uint8Array | null> {
  const res = await safeFetch(url, { timeoutMs: LABEL_FETCH_TIMEOUT_MS })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`Label link answered ${res.status}`)
  }
  const bytes = await readCapped(res, LABEL_MAX_BYTES)
  if (!bytes) throw new Error('Label file too large')
  return bytes
}
