import type { AppBlockDefinition, AppEmbedDefinition } from '@commerce/plugins'
import type { ComponentConfig, Fields } from '@puckeditor/core'

/** One entry in the Apps tab's "Notify me · by Back in stock" grouping. */
export type AppBlockOwner = { appName: string; appIcon: string | undefined }

/**
 * What the builder needs from a plugin: enough to group and label its blocks
 * in the Add panel, plus the blocks themselves. A real `PluginManifest`
 * satisfies this; so does the client-safe mirror `commerce.blocks.config.ts`
 * uses (see docs/plugins.md) since the admin editor cannot import a manifest
 * that pulls in the database driver.
 */
export type AppBlockSource = {
  id: string
  name: string
  icon?: string | undefined
  blocks?: AppBlockDefinition[] | undefined
  /** Site-wide widgets the app offers (theme editor → Apps); the same array as its manifest's. */
  embeds?: AppEmbedDefinition[] | undefined
}

export type BuiltAppBlocks = {
  /** `categories.apps.components` — only blocks from an enabled source. */
  categoryComponents: string[]
  /** Every declared block, enabled or not, so a saved placement never hits a missing component. */
  components: Record<string, ComponentConfig<Record<string, unknown>>>
  /** Owner (app name + icon) for each enabled block, for the Add panel's grouping. */
  owners: Record<string, AppBlockOwner>
}

const EMPTY: BuiltAppBlocks = { categoryComponents: [], components: {}, owners: {} }

function offPlaceholder(
  block: AppBlockDefinition,
  appName: string,
): ComponentConfig<Record<string, unknown>> {
  return {
    label: block.label,
    fields: block.fields as Fields,
    defaultProps: block.defaultProps,
    render: () => (
      <div className="app-block-off" role="note">
        <p className="app-block-off__text text-small">This app is off — {appName}</p>
      </div>
    ),
  }
}

/**
 * Assemble the Puck editor config and the storefront render config for app
 * blocks, from every plugin the deployment ships (`allSources`) and the ids
 * enabled for this store (`enabledIds`). Pure and side-effect free, so it is
 * exercised directly in tests without a Puck editor or a database.
 *
 * A block from a source not in `enabledIds` still gets a component — a
 * disabled placeholder, never the real render — so a page that already
 * placed it keeps loading instead of crashing the editor; it is left out of
 * `categoryComponents`, so it also disappears from the Add panel. A block
 * whose `type` collides with another source's, or that is not namespaced
 * `<sourceId>/<Name>`, throws: two apps can never fight over one slot.
 */
export function buildAppBlocks(
  allSources: AppBlockSource[],
  enabledIds: ReadonlySet<string>,
): BuiltAppBlocks {
  if (allSources.length === 0) return EMPTY
  const categoryComponents: string[] = []
  const components: Record<string, ComponentConfig<Record<string, unknown>>> = {}
  const owners: Record<string, AppBlockOwner> = {}
  const seen = new Map<string, string>()

  for (const source of allSources) {
    const enabled = enabledIds.has(source.id)
    for (const block of source.blocks ?? []) {
      if (!block.type.startsWith(`${source.id}/`)) {
        throw new Error(
          `app block "${block.type}" from "${source.id}" must be namespaced "${source.id}/<Name>"`,
        )
      }
      const priorOwner = seen.get(block.type)
      if (priorOwner) {
        throw new Error(
          `app block "${block.type}" is declared by both "${priorOwner}" and "${source.id}"`,
        )
      }
      seen.set(block.type, source.id)

      if (!enabled) {
        components[block.type] = offPlaceholder(block, source.name)
        continue
      }
      categoryComponents.push(block.type)
      const component: ComponentConfig<Record<string, unknown>> = {
        label: block.label,
        fields: block.fields as Fields,
        defaultProps: block.defaultProps,
        render: block.render as ComponentConfig<Record<string, unknown>>['render'],
      }
      if (block.resolveData) {
        component.resolveData = block.resolveData as NonNullable<
          ComponentConfig<Record<string, unknown>>['resolveData']
        >
      }
      components[block.type] = component
      owners[block.type] = { appName: source.name, appIcon: source.icon }
    }
  }

  return { categoryComponents, components, owners }
}
