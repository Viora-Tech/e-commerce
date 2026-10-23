import type { MetafieldOwnerType } from '@commerce/core/metaobjects'
import { METAFIELD_OWNER_TYPES } from '@commerce/core/metaobjects'
import {
  FieldSwatch,
  FileText,
  FolderOpen,
  type LucideIcon,
  Newspaper,
  Package,
  ShoppingBag,
  Store,
  Users,
} from '@commerce/ui/icons'
import type { customDataContent } from './metaobjects'

type Tab = keyof (typeof customDataContent)['tabs']

export type CustomDataOwner = {
  owner: MetafieldOwnerType
  /** The address segment under /settings/custom-data. */
  slug: string
  /** Its label (and the old tab's id, for `?tab=` links) in `customDataContent.tabs`. */
  tab: Tab
  icon: LucideIcon
}

/** Per owner type; a new type in core fails to compile here until it has a page. */
const DETAILS: Record<MetafieldOwnerType, Omit<CustomDataOwner, 'owner'>> = {
  product: { slug: 'products', tab: 'products', icon: Package },
  variant: { slug: 'variants', tab: 'variants', icon: FieldSwatch },
  collection: { slug: 'collections', tab: 'collections', icon: FolderOpen },
  customer: { slug: 'customers', tab: 'customers', icon: Users },
  order: { slug: 'orders', tab: 'orders', icon: ShoppingBag },
  page: { slug: 'pages', tab: 'pages', icon: FileText },
  article: { slug: 'blog-posts', tab: 'articles', icon: Newspaper },
  shop: { slug: 'store', tab: 'shop', icon: Store },
}

/** Every kind of record that takes extra fields, in the order Settings → Custom data lists them. */
export const CUSTOM_DATA_OWNERS: readonly CustomDataOwner[] = METAFIELD_OWNER_TYPES.map(
  (owner) => ({ owner, ...DETAILS[owner] }),
)

export function ownerBySlug(slug: string): CustomDataOwner | null {
  return CUSTOM_DATA_OWNERS.find((o) => o.slug === slug) ?? null
}

/** Settings → Custom data's overview and each kind of record's page. */
export const customDataOverviewContent = {
  back: 'Custom data',
  overview: {
    fieldsHeading: 'Extra fields',
    fieldsBody: 'Fields you add to a kind of record. Open one to add, edit or reorder its fields.',
    columns: { kind: 'Record', fields: 'Fields' },
    count: (n: number) => (n === 0 ? 'No fields yet' : n === 1 ? '1 field' : `${n} fields`),
    typesColumns: { type: 'Content type', entries: 'Entries' },
    typesEmptyHeading: 'No content types yet',
    typesEmptyBody:
      'Make your own kind of content, like FAQs, size charts or store locations. Start blank or from a ready-made preset.',
  },
  /** One line under each kind of record in the overview. */
  ownerHints: {
    product: 'Care guides, materials, warranty',
    variant: 'Per size or colour, like a fit note',
    collection: 'Banners and extra copy for a collection',
    customer: 'Private notes, like a birthday or a GST number',
    order: 'Private details, like a gift message',
    page: 'Extra content for your pages',
    article: 'Extra content for your blog posts',
    shop: 'Values for the whole store, like a support number',
  },
} as const
