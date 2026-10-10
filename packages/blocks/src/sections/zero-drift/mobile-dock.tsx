import type { ComponentConfig } from '@puckeditor/core'
import MobileDock from '../../components/sections/zero-drift/mobile-dock'
import { mobileDockContent as copy } from '../../data/zero-drift/mobile-dock'
import type { SectionMetadata } from '../dynamic'
import { inlineText } from '../inline-fields'
import { hasCopy } from '../main-product-settings'

export type MobileDockProps = {
  links: { icon: string; label: string; url: string }[]
}

const f = copy.fields

/** The cart count the storefront hands the footer group (`appBlockContext.cartCount`). */
function cartCountOf(meta: SectionMetadata): number {
  const count = meta.appBlockContext?.cartCount
  return typeof count === 'number' && count > 0 ? count : 0
}

/**
 * Zero Drift's mobile dock (`sections/mobile-dock.liquid`), a footer-group section. Not framed:
 * the bar is fixed to the bottom of the screen, so a padded section box around it would only
 * leave a gap in the footer.
 */
export function mobileDockSection(): ComponentConfig {
  const config: ComponentConfig<MobileDockProps> = {
    label: copy.label,
    fields: {
      links: {
        type: 'array',
        label: f.links,
        max: copy.maxLinks,
        getItemSummary: (l) => (typeof l.label === 'string' && l.label) || f.fallback,
        defaultItemProps: { ...copy.newLink },
        arrayFields: {
          icon: { type: 'select', label: f.icon, options: [...copy.icons] },
          label: inlineText(f.label),
          url: { type: 'text', label: f.url },
        },
      },
    },
    defaultProps: { links: copy.links.map((l) => ({ ...l })) },
    render: ({ puck, links }) => (
      <MobileDock
        links={(links ?? []).filter((l) => hasCopy(l.label)).slice(0, copy.maxLinks)}
        cartCount={cartCountOf((puck?.metadata ?? {}) as SectionMetadata)}
      />
    ),
  }
  return config as unknown as ComponentConfig
}
