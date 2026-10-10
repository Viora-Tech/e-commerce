import PromoBento from '../../components/sections/zero-drift/promo-bento'
import type { PromoTileView } from '../../components/sections/zero-drift/promo-tile'
import { promoBentoContent as copy } from '../../data/zero-drift/promo-bento'
import { defaultSectionSettings } from '../../section-settings'
import { type Frame, framed, type Image, imageField, noImage } from '../framed'
import { inlineText } from '../inline-fields'
import type { ZeroDriftLoaders } from './loaders'

type TileItem = {
  collectionHandle: string
  productHandle: string
  image: Image
  videoUrl: string
  imageFit: 'cover' | 'contain'
  textTheme: 'light' | 'dark'
  size: 'small' | 'wide' | 'tall' | 'large'
  showText: boolean
  eyebrow: string
  title: string
  subtitle: string
  link: string
}

/** What a tile falls back to for whatever the merchant left blank. */
type ResolvedTile = { title: string; href: string; imageUrl: string }

export type PromoBentoProps = Frame & {
  heading: string
  subheading: string
  textReveal: 'always' | 'hover'
  tiles: TileItem[]
  /** Filled by resolveData; not edited directly. */
  resolved?: ResolvedTile[]
}

const defaults = {
  heading: copy.heading,
  subheading: copy.subheading,
  textReveal: 'always' as const,
  tiles: copy.tiles.map((t) => ({ ...copy.newTile, ...t, image: noImage })) as TileItem[],
}

function toView(tile: TileItem, fallback: ResolvedTile | undefined): PromoTileView {
  const href = tile.link || fallback?.href || ''
  return {
    size: tile.size,
    fit: tile.imageFit,
    textTheme: tile.textTheme,
    href,
    newTab: false,
    videoUrl: tile.videoUrl,
    image: tile.image.url ? tile.image : { url: fallback?.imageUrl ?? '', alt: '' },
    eyebrow: tile.eyebrow,
    title: tile.title ? tile.title : (fallback?.title ?? ''),
    subtitle: tile.subtitle,
    showText: tile.showText,
  }
}

export function promoBentoSection(loaders: ZeroDriftLoaders) {
  return framed<PromoBentoProps>(
    copy.label,
    {
      heading: inlineText('Heading'),
      subheading: inlineText('Subheading'),
      textReveal: {
        type: 'radio',
        label: 'Tile text',
        options: copy.reveals,
      },
      tiles: {
        type: 'array',
        label: 'Tiles',
        max: copy.maxTiles,
        getItemSummary: (t: { title?: string; collectionHandle?: string }) =>
          (typeof t.title === 'string' && t.title) || t.collectionHandle || 'Tile',
        defaultItemProps: { ...copy.newTile, image: noImage },
        arrayFields: {
          size: { type: 'select', label: 'Size', options: copy.sizes },
          collectionHandle: {
            type: 'text',
            label: 'Collection handle (fills the image, title and link)',
          },
          productHandle: {
            type: 'text',
            label: "Product handle (borrows this product's photo and link)",
          },
          image: imageField('Image (overrides the collection and product)'),
          videoUrl: { type: 'text', label: 'Video link (a short muted loop, overrides the image)' },
          imageFit: { type: 'select', label: 'Image fit', options: copy.fits },
          textTheme: { type: 'select', label: 'Text colour', options: copy.textThemes },
          showText: {
            type: 'radio',
            label: 'Show text on this tile',
            options: [
              { label: 'Yes', value: true },
              { label: 'No (picture only)', value: false },
            ],
          },
          eyebrow: inlineText('Eyebrow'),
          title: inlineText('Title (blank uses the collection or product name)'),
          subtitle: inlineText('Subtitle'),
          link: { type: 'text', label: 'Link (blank uses the collection or product)' },
        },
      },
    },
    defaults,
    (p) => (
      <PromoBento
        heading={p.heading}
        subheading={p.subheading}
        textReveal={p.textReveal}
        tiles={(p.tiles ?? []).map((t, i) => toView(t, p.resolved?.[i]))}
      />
    ),
    {
      defaultProps: {
        ...defaults,
        settings: defaultSectionSettings({ scheme: 'scheme-5', padTop: 64, padBottom: 64 }),
      },
      resolveData: async ({ props }) => {
        const tiles = props.tiles ?? []
        const handles = tiles.map((t) => t.collectionHandle).filter(Boolean)
        const collections =
          loaders.loadCollections && handles.length ? await loaders.loadCollections(handles) : []
        const resolved: ResolvedTile[] = await Promise.all(
          tiles.map(async (tile) => {
            const c = collections.find((x) => x.handle === tile.collectionHandle)
            const product =
              tile.productHandle && loaders.loadProduct
                ? await loaders.loadProduct(tile.productHandle)
                : null
            let imageUrl = product?.images[0]?.url ?? c?.imageUrl ?? ''
            if (!tile.image.url && !imageUrl && tile.collectionHandle) {
              const first = await loaders.loadProducts({
                collectionHandle: tile.collectionHandle,
                limit: 1,
              })
              imageUrl = first[0]?.images[0]?.url ?? ''
            }
            const href = tile.collectionHandle
              ? `/collections/${tile.collectionHandle}`
              : product
                ? `/products/${product.handle}`
                : ''
            return { title: c?.title ?? product?.title ?? '', href, imageUrl }
          }),
        )
        return { props: { resolved }, readOnly: { resolved: true } }
      },
    },
  )
}
