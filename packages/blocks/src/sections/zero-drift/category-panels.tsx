import SectionHeading from '../../components/section-heading'
import CategoryPanels, {
  type CategoryPanel,
} from '../../components/sections/zero-drift/category-panels'
import { categoryPanelsContent as copy } from '../../data/zero-drift/category-panels'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

type PanelItem = { collectionHandle: string; title: string; text: string; image: Image }

/** What a panel falls back to when the merchant left the name, line or image blank. */
type ResolvedPanel = { title: string; count: number; imageUrl: string }

export type CategoryPanelsProps = Frame & {
  kicker: string
  heading: string
  panels: PanelItem[]
  /** Filled by resolveData; not edited directly. */
  resolved?: ResolvedPanel[]
}

const defaults = {
  kicker: copy.kicker,
  heading: copy.heading,
  panels: copy.panels.map((p) => ({ ...p, image: noImage })),
}

export function categoryPanelsSection(loaders: ZeroDriftLoaders) {
  return framed<CategoryPanelsProps>(
    copy.label,
    {
      kicker: inlineText('Kicker'),
      heading: inlineText('Heading'),
      panels: {
        type: 'array',
        label: 'Panels',
        max: copy.maxPanels,
        getItemSummary: (p: { title?: string; collectionHandle?: string }) =>
          (typeof p.title === 'string' && p.title) || p.collectionHandle || 'Category',
        defaultItemProps: { ...copy.newPanel, image: noImage },
        arrayFields: {
          collectionHandle: { type: 'text', label: 'Collection handle' },
          title: inlineText('Name (blank uses the collection name)'),
          text: inlineText('Line on top (blank shows the product count)'),
          image: imageField('Image (blank uses the collection image or its first product)'),
        },
      },
    },
    defaults,
    (p) => {
      const panels: CategoryPanel[] = (p.panels ?? []).map((panel, i) => {
        const fallback = p.resolved?.[i]
        return {
          href: panel.collectionHandle ? `/collections/${panel.collectionHandle}` : '#',
          title: panel.title ? panel.title : (fallback?.title ?? ''),
          meta: panel.text
            ? panel.text
            : fallback
              ? copy.countLine.replace('{count}', String(fallback.count))
              : '',
          image: panel.image.url ? panel.image : { url: fallback?.imageUrl ?? '', alt: '' },
        }
      })
      return (
        <div className="category-panels">
          {p.heading ? <SectionHeading kicker={p.kicker} heading={p.heading} /> : null}
          <CategoryPanels panels={panels} />
        </div>
      )
    },
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 48, padBottom: 48 }),
      },
      resolveData: async ({ props }) => {
        const panels = props.panels ?? []
        const handles = panels.map((x) => x.collectionHandle).filter(Boolean)
        const collections = loaders.loadCollections ? await loaders.loadCollections(handles) : []
        const resolved: ResolvedPanel[] = await Promise.all(
          panels.map(async (panel) => {
            const c = collections.find((x) => x.handle === panel.collectionHandle)
            let imageUrl = c?.imageUrl ?? ''
            if (!panel.image.url && !imageUrl && panel.collectionHandle) {
              const first = await loaders.loadProducts({
                collectionHandle: panel.collectionHandle,
                limit: 1,
              })
              imageUrl = first[0]?.images[0]?.url ?? ''
            }
            return { title: c?.title ?? '', count: c?.productCount ?? 0, imageUrl }
          }),
        )
        return { props: { resolved }, readOnly: { resolved: true } }
      },
    },
  )
}
