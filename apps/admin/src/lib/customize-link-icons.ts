import {
  ClipboardList,
  FileText,
  FolderOpen,
  Globe,
  Home,
  type IconComponent,
  Newspaper,
  Package,
} from '@commerce/ui/icons'
import type { LinkKind } from './customize-links'

/** The glyph for each kind of link target, shared by the picker's rows and the chosen-link chip. */
export const LINK_KIND_ICONS: Record<LinkKind | 'home' | 'url', IconComponent> = {
  product: Package,
  collection: FolderOpen,
  page: FileText,
  article: Newspaper,
  policy: ClipboardList,
  home: Home,
  url: Globe,
}
