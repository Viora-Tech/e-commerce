/** SOURCE OF TRUTH: AppBlockDefinition, AppEmbedDefinition, PluginStorefront — WHAT: the storefront blocks and app embeds a plugin contributes / WHY: structurally typed so the plugin contract needs no Puck/React dependency; split out of types.ts */
/**
 * A storefront section an installed app contributes to the theme editor's
 * Add panel → Apps tab (Shopify's "app blocks"). `type` must be namespaced
 * `<pluginId>/<Name>` so two apps can never collide; `fields`/`defaultProps`
 * drive the Puck editor form and `render` draws it on the storefront.
 * Kept structurally typed (`unknown`) here so this package stays free of a
 * Puck/React dependency — `@commerce/blocks`'s builder (`buildAppBlocks`)
 * casts these back into real Puck `ComponentConfig`s when it assembles the
 * live config from enabled plugins. See docs/plugins.md.
 */
export type AppBlockDefinition = {
  /** `<pluginId>/<Name>`, e.g. `back-in-stock/NotifyMe`. */
  type: string
  label: string
  description?: string | undefined
  /** Icon name from the admin icon set, shown next to the block in the Add panel. */
  icon?: string | undefined
  /** Puck `Fields` for the block's settings panel. */
  fields: Record<string, unknown>
  defaultProps: Record<string, unknown>
  /** Puck `ComponentConfig['render']`. Client islands are fine; keep it RSC-safe where possible. */
  // biome-ignore lint/suspicious/noExplicitAny: erased Puck render signature; re-typed by the blocks builder.
  render: (props: any) => unknown
  /** Puck `ComponentConfig['resolveData']`, for a block that needs server data before it draws. */
  // biome-ignore lint/suspicious/noExplicitAny: erased Puck resolveData signature; re-typed by the blocks builder.
  resolveData?: ((args: any) => Promise<any>) | undefined
}

/**
 * A site-wide storefront widget an installed app contributes (Shopify's "app embeds"): a chat
 * bubble, a pop-up, a floating bar. Unlike a block it is not placed on a page; the merchant turns
 * it on per theme in the theme editor's Apps panel and edits its settings there, and the
 * storefront draws every embed that is on, once per page. `type` is namespaced like a block's.
 * Structurally typed for the same reason as `AppBlockDefinition`.
 */
export type AppEmbedDefinition = {
  /** `<pluginId>/<Name>`, e.g. `inbox/Chat`. */
  type: string
  label: string
  description?: string | undefined
  /** Puck `Fields` for the embed's settings in the Apps panel. */
  fields: Record<string, unknown>
  defaultProps: Record<string, unknown>
  /** Off until the merchant turns it on, unless this says otherwise. */
  enabledByDefault?: boolean | undefined
  /** Draws the embed with its settings. Client islands are fine. */
  // biome-ignore lint/suspicious/noExplicitAny: erased render signature, like AppBlockDefinition.
  render: (props: any) => unknown
}

/** What a plugin contributes to the storefront beyond providers. */
export type PluginStorefront = {
  blocks?: AppBlockDefinition[] | undefined
  embeds?: AppEmbedDefinition[] | undefined
}
