import type { ComponentConfig } from '@puckeditor/core'
import PerfectMatch from '../../components/sections/glide/perfect-match'
import { perfectMatchContent as copy } from '../../data/glide/perfect-match'
import { defaultSectionSettings } from '../../section-settings'
import type { CardProduct } from '../../types'
import { type Frame, framed, type Link, linkField } from '../framed'
import { inlineText } from '../inline-fields'
import type { GlideLoaders } from './loaders'
import { pickMatchProducts } from './perfect-match-picks'

export type PerfectMatchProps = Frame & {
  eyebrow: string
  headingBefore: string
  highlight: string
  headingAfter: string
  highlightWords: string
  cta: Link
  curated: { handle: string }[]
  categories: { label: string; collectionHandle: string }[]
  poolCollection: string
  /** Filled by resolveData; not edited directly. */
  resolved?: CardProduct[]
}

const fields = {
  eyebrow: inlineText('Small line above the heading'),
  headingBefore: inlineText('Heading, before the highlighted word'),
  highlight: inlineText('Highlighted word'),
  headingAfter: inlineText('Heading, after the highlighted word'),
  highlightWords: {
    type: 'text',
    label: 'Other words the highlight cycles through (separate with |)',
  },
  cta: linkField('Button'),
  curated: {
    type: 'array',
    label: 'Products to always show (up to 6)',
    max: copy.maxProducts,
    getItemSummary: (c: { handle?: string }) => c.handle || 'Product',
    arrayFields: { handle: { type: 'text', label: 'Product link name (handle)' } },
  },
  categories: {
    type: 'array',
    label: 'Categories (one product from each fills the rest of the ring)',
    getItemSummary: (c: { label?: string }) => c.label || 'Category',
    arrayFields: {
      label: { type: 'text', label: 'Name' },
      collectionHandle: { type: 'text', label: 'Collection link name (handle)' },
    },
  },
  poolCollection: {
    type: 'text',
    label: 'Fill any empty spots from this collection (blank = all products)',
  },
}

const defaults: Omit<PerfectMatchProps, keyof Frame> = {
  eyebrow: copy.eyebrow,
  headingBefore: copy.headingBefore,
  highlight: copy.highlight,
  headingAfter: copy.headingAfter,
  highlightWords: copy.highlightWords,
  cta: { ...copy.cta },
  curated: [...copy.curated],
  categories: copy.categories.map((c) => ({ ...c })),
  poolCollection: copy.poolCollection,
}

// Port of sections/perfect-match.liquid. Products come only through the loaders: hand-picked
// handles first, then one per category collection, then the general pool.
export function perfectMatchSection(loaders: GlideLoaders): ComponentConfig {
  const { loadProducts, loadProduct } = loaders
  return framed<PerfectMatchProps>(
    'Perfect match',
    fields,
    defaults,
    (p) => (
      <PerfectMatch
        eyebrow={p.eyebrow}
        headingBefore={p.headingBefore}
        highlight={p.highlight}
        headingAfter={p.headingAfter}
        highlightWords={p.highlightWords}
        cta={p.cta}
        products={p.resolved ?? []}
      />
    ),
    {
      defaultProps: {
        settings: defaultSectionSettings({ scheme: 'scheme-1', padTop: 0, padBottom: 0 }),
        ...defaults,
      },
      resolveData: async ({ props }) => {
        const handles = (props.curated ?? []).map((c) => c.handle).filter(Boolean)
        const [curated, categories, pool] = await Promise.all([
          Promise.all(handles.map((h) => (loadProduct ? loadProduct(h) : Promise.resolve(null)))),
          Promise.all(
            (props.categories ?? [])
              .filter((c) => c.collectionHandle)
              .map((c) =>
                loadProducts({
                  collectionHandle: c.collectionHandle,
                  limit: copy.candidatesPerCategory,
                }),
              ),
          ),
          loadProducts({
            collectionHandle: props.poolCollection || undefined,
            limit: copy.candidatesPerCategory,
          }),
        ])
        const resolved = pickMatchProducts({
          curated: curated.filter((c): c is CardProduct => c !== null),
          categories,
          pool,
          now: Math.floor(Date.now() / 1000),
        })
        return { props: { resolved }, readOnly: { resolved: true } }
      },
    },
  )
}
