'use client'

import { resolveAppEmbeds } from '@commerce/core/theme'
import { Fragment, type ReactNode, useEffect, useState } from 'react'
import { canvasAppEmbedData } from '@/lib/canvas-app-embed-data'
import { editorAppEmbedSources } from '@/lib/customize-app-embeds'
import { useInstalledApps, useThemePreview } from '@/lib/customize-theme-context'

/** The embeds that are on, keyed by what they draw from (type and settings). */
const keyOf = (on: { embed: { type: string }; props: Record<string, unknown> }[]) =>
  JSON.stringify(on.map((e) => [e.embed.type, e.props]))

/**
 * Every app embed that is on in the theme being edited (App embeds panel), drawn on the canvas
 * where the store draws it: the Reviews app's floating tab and any later embed. The storefront
 * draws them on every page (`components/theme/app-embeds.tsx`) but the canvas renders sections
 * only, so without this they never showed while editing. Unsaved switches and settings show at
 * once. A picture only: clicks pass through to the page.
 */
export default function CanvasAppEmbeds() {
  // Hooks
  const theme = useThemePreview()
  const installed = useInstalledApps()
  const [data, setData] = useState<Record<string, unknown>>({})
  const on = theme
    ? resolveAppEmbeds(editorAppEmbedSources(new Set(installed)), theme.appEmbeds).filter(
        (e) => e.enabled,
      )
    : []
  const key = keyOf(on)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `on`, which is rebuilt each render.
  useEffect(() => {
    let active = true
    Promise.all(
      on.map((e) => canvasAppEmbedData(e.embed.type, e.props).catch(() => undefined)),
    ).then((loaded) => {
      if (!active) return
      setData(Object.fromEntries(on.map((e, i) => [e.embed.type, loaded[i]])))
    })
    return () => {
      active = false
    }
  }, [key])

  // Early returns
  if (on.length === 0) return null

  // Render logic
  return (
    <div aria-hidden className="pointer-events-none">
      {on.map((e) => {
        const loaded = data[e.embed.type]
        return (
          <Fragment key={e.embed.type}>
            {
              e.embed.render(
                loaded === undefined ? e.props : { ...e.props, data: loaded },
              ) as ReactNode
            }
          </Fragment>
        )
      })}
    </div>
  )
}
