/** SOURCE OF TRUTH: phone picker metadata — WHAT: `phoneInputMetadata`, the numbering metadata both phone inputs (admin `@commerce/ui`, storefront `@commerce/blocks`) pass to react-phone-number-input / WHY: the picker fills its box from `formatNational()`, which adds India's optional trunk 0 (#926) */

import type { MetadataJson } from 'libphonenumber-js/core'
import metadata from 'libphonenumber-js/min/metadata'

/**
 * The numbering metadata without the trunk prefix where a country's national format only
 * optionally writes it. The picker fills the number box from `formatNational()`, which writes an
 * Indian mobile as "098765 43210", so a saved or prefilled "+919876543210" showed a 0 nobody
 * typed. Countries whose national format needs the 0 (UK "07911 123456") keep it, and a typed 0
 * is still read as the trunk prefix.
 */
export function withoutOptionalTrunkPrefix(meta: MetadataJson): MetadataJson {
  const countries = Object.fromEntries(
    Object.entries(meta.countries).map(([code, plan]) => {
      // Format rows: [pattern, format, leading digits, prefix formatting rule, prefix optional, ...].
      const formats = (plan as unknown[])[4]
      if (!Array.isArray(formats)) return [code, plan]
      const next = [...(plan as unknown[])]
      next[4] = formats.map((f: unknown[]) =>
        f[4] && typeof f[3] === 'string' ? [f[0], f[1], f[2], '$1', ...f.slice(4)] : f,
      )
      return [code, next]
    }),
  )
  return { ...meta, countries } as MetadataJson
}

/** Pass as the picker's `metadata` prop. */
export const phoneInputMetadata = withoutOptionalTrunkPrefix(metadata)
