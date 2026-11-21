'use client'

import { Fragment, type ReactNode } from 'react'
import { useCanvasAppEmbeds } from '@/lib/use-canvas-app-embeds'

/**
 * Every app embed that is on in the theme being edited (App embeds panel), drawn on the canvas
 * where the store draws it: the Reviews app's floating tab and any later embed. The storefront
 * draws them on every page (`components/theme/app-embeds.tsx`) but the canvas renders sections
 * only, so without this they never showed while editing. Unsaved switches and settings show at
 * once. A picture only: clicks pass through to the page.
 */
export default function CanvasAppEmbeds() {
  // Hooks
  const { on, data } = useCanvasAppEmbeds()

  // Early returns
  if (on.length === 0) return null

  // Render logic
  return (
    <div aria-hidden className="pointer-events-none">
      {on.map((e) => {
        const loaded = data[e.embed.type]
        const props = loaded === undefined ? e.props : { ...e.props, data: loaded }
        return <Fragment key={e.embed.type}>{e.embed.render(props) as ReactNode}</Fragment>
      })}
    </div>
  )
}
