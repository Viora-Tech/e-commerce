/** SOURCE OF TRUTH: a Shopify theme's app embeds — WHAT: the app embed blocks `settings_data.json` keeps under `current.blocks` (`shopify://apps/<app>/blocks/<embed>/<uuid>`), read for the editor with the app of ours that draws each one, if any / WHY: an import keeps them in the theme's settings untouched; the editor lists them so the merchant sees which still show and which have no app here. Browser safe */
import { appBlockName, isAppBlockType } from './app-block-slots'

/** One app embed the imported theme was saved with. */
export type ImportedAppEmbed = {
  id: string
  type: string
  /** `Judge me reviews: Floating tab`. */
  name: string
  /** Off in the theme (`disabled: true`). */
  enabled: boolean
  /** Our app that draws it on the store, or null when we have none. */
  ours: 'inbox' | 'reviews' | null
}

/** Which of our apps stands in for an embed: Shopify Inbox's chat → Inbox, Judge.me → Reviews. */
function oursFor(type: string): ImportedAppEmbed['ours'] {
  const app = /^shopify:\/\/apps\/([^/]+)\//i.exec(type)?.[1]?.toLowerCase() ?? ''
  if (app === 'inbox' || app === 'shopify-inbox') return 'inbox'
  return app.startsWith('judge-me') ? 'reviews' : null
}

/** The app embeds in an imported theme's settings (`current.blocks`), in saved order. */
export function importedAppEmbeds(settings: Record<string, unknown>): ImportedAppEmbed[] {
  const blocks = settings.blocks
  if (!blocks || typeof blocks !== 'object' || Array.isArray(blocks)) return []
  return Object.entries(blocks as Record<string, unknown>).flatMap(([id, raw]) => {
    if (!raw || typeof raw !== 'object') return []
    const b = raw as { type?: unknown; disabled?: unknown }
    if (typeof b.type !== 'string' || !isAppBlockType(b.type)) return []
    return [
      {
        id,
        type: b.type,
        name: appBlockName(b.type),
        enabled: b.disabled !== true,
        ours: oursFor(b.type),
      },
    ]
  })
}
