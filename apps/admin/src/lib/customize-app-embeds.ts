/** SOURCE OF TRUTH: the theme editor's app embeds — WHAT: the embeds the store's installed apps offer, from the client-safe block sources / WHY: the editor runs in the browser and cannot load real plugin manifests */
import { type AppEmbedSource, appEmbedSources } from '@commerce/core/theme'
import { APP_BLOCK_SOURCES } from '../../../../commerce.blocks.config'

/** The embeds of the apps this store has installed, in app order. */
export function editorAppEmbedSources(installed: ReadonlySet<string>): AppEmbedSource[] {
  return appEmbedSources(
    APP_BLOCK_SOURCES.map((s) => ({ id: s.id, name: s.name, storefront: { embeds: s.embeds } })),
    installed,
  )
}
