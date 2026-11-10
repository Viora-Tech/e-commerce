'use client'

import { type LiquidField, liquidSectionFields } from '@commerce/core/theme-import'
import { useEffect, useState } from 'react'
import { api } from './api-client'

export type LiquidEditorInfo = NonNullable<Awaited<ReturnType<typeof api.themes.import.editor>>>

/**
 * For an imported Shopify theme: its section schemas and head (stylesheets, fonts) for the
 * canvas, and the editor fields generated from each schema. `null` for our own themes,
 * `undefined` while loading.
 */
export function useLiquidTheme(
  themeId: string,
  /** Loaded with the page (#1314): the canvas starts rendering on the first paint. */
  initial?: LiquidEditorInfo | null | undefined,
): {
  info: LiquidEditorInfo | null | undefined
  fields: Record<string, Record<string, LiquidField>> | null
} {
  const [info, setInfo] = useState<LiquidEditorInfo | null | undefined>(initial)
  const [loadedFor] = useState(initial === undefined ? null : themeId)

  useEffect(() => {
    // The page already brought this theme's info: no second round trip.
    if (loadedFor === themeId) return
    let active = true
    api.themes.import.editor({ themeId }).then(
      (next) => active && setInfo(next),
      () => active && setInfo(null),
    )
    return () => {
      active = false
    }
  }, [themeId, loadedFor])

  const fields = info
    ? Object.fromEntries(
        Object.entries(info.schemas).map(([type, schema]) => [
          type,
          liquidSectionFields(schema, info.schemaLocale, info.blockSchemas, {
            colorSchemes: info.colorSchemes,
          }),
        ]),
      )
    : null
  return { info, fields }
}
