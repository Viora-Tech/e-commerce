'use client'

import { resolveAppEmbeds } from '@commerce/core/theme'
import { useEffect, useState } from 'react'
import { canvasAppEmbedData } from './canvas-app-embed-data'
import { editorAppEmbedSources } from './customize-app-embeds'
import { useInstalledApps, useThemePreview } from './customize-theme-context'

/**
 * The app embeds that are on in the theme being edited (unsaved switches included), each with the
 * store data it draws from (`canvasAppEmbedData`). Every theme edit rebuilds the list; the data
 * reloads only when an embed or its settings change.
 */
export function useCanvasAppEmbeds() {
  const theme = useThemePreview()
  const installed = useInstalledApps()
  const [data, setData] = useState<Record<string, unknown>>({})
  const on = theme
    ? resolveAppEmbeds(editorAppEmbedSources(new Set(installed)), theme.appEmbeds).filter(
        (e) => e.enabled,
      )
    : []
  const key = JSON.stringify(on.map((e) => [e.embed.type, e.props]))

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `on`, rebuilt each render.
  useEffect(() => {
    let active = true
    Promise.all(
      on.map((e) => canvasAppEmbedData(e.embed.type, e.props).catch(() => undefined)),
    ).then((loaded) => {
      if (active) setData(Object.fromEntries(on.map((e, i) => [e.embed.type, loaded[i]])))
    })
    return () => {
      active = false
    }
  }, [key])

  return { on, data }
}
