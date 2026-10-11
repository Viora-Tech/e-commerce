import type { ImportResource } from '@commerce/plugin-shopify-import/client'
import {
  ArrowLeftRight,
  BadgePercent,
  Boxes,
  FieldList,
  FileText,
  Gift,
  type IconComponent,
  Images,
  LayoutGrid,
  Newspaper,
  Package,
  ReceiptIcon,
  SlidersHorizontal,
  Users,
} from '@commerce/ui/icons'

/** One glyph per thing an import can bring over, shared by the type cards and sample tabs. */
export const RESOURCE_ICON: Record<ImportResource, IconComponent> = {
  products: Package,
  collections: LayoutGrid,
  customers: Users,
  orders: ReceiptIcon,
  pages: FileText,
  articles: Newspaper,
  menus: FieldList,
  redirects: ArrowLeftRight,
  files: Images,
  metaobjects: Boxes,
  metafields: SlidersHorizontal,
  discounts: BadgePercent,
  gift_cards: Gift,
}
