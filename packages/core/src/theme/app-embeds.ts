/** SOURCE OF TRUTH: app embeds in a theme — WHAT: which installed apps' site-wide widgets are on in a theme, and the settings each draws with / WHY: the storefront and the theme editor's Apps panel must agree on what is on */
import type { AppEmbedDefinition } from '@commerce/plugins'
import type { Theme } from './schema'

/** An embed an installed app offers, with the app it belongs to. */
export type AppEmbedSource = {
  appId: string
  appName: string
  embed: AppEmbedDefinition
}

/** An embed as a theme has it: whether it is on, and the settings it draws with. */
export type ResolvedAppEmbed = AppEmbedSource & {
  enabled: boolean
  /** The embed's defaults with the merchant's changes on top. */
  props: Record<string, unknown>
}

/**
 * Every embed the installed apps offer, as this theme has it. An embed the theme never touched
 * uses its own `enabledByDefault` and defaults; settings the embed no longer has are dropped.
 */
export function resolveAppEmbeds(
  sources: readonly AppEmbedSource[],
  appEmbeds: Theme['appEmbeds'],
): ResolvedAppEmbed[] {
  return sources.map((source) => {
    const saved = appEmbeds[source.embed.type]
    const defaults = source.embed.defaultProps
    const changed = Object.fromEntries(
      Object.entries(saved?.settings ?? {}).filter(([key]) => key in defaults),
    )
    return {
      ...source,
      enabled: saved?.enabled ?? source.embed.enabledByDefault ?? false,
      props: { ...defaults, ...changed },
    }
  })
}

/** The embed sources of the apps a store has installed, in app order. */
export function appEmbedSources(
  plugins: readonly {
    id: string
    name: string
    storefront?: { embeds?: AppEmbedDefinition[] | undefined } | undefined
  }[],
  installed: ReadonlySet<string>,
): AppEmbedSource[] {
  return plugins.flatMap((p) => {
    if (!installed.has(p.id)) return []
    return (p.storefront?.embeds ?? []).map((embed) => {
      if (!embed.type.startsWith(`${p.id}/`)) {
        throw new Error(
          `app embed "${embed.type}" from "${p.id}" must be namespaced "${p.id}/<Name>"`,
        )
      }
      return { appId: p.id, appName: p.name, embed }
    })
  })
}
