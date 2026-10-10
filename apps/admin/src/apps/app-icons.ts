/**
 * App icon names (a manifest's `admin.icon`, an app block's owner icon) to admin icons. Kept out
 * of `./registry` so client code that only needs an icon (the theme editor) does not bundle
 * every app's admin pages.
 */
import {
  BarChart3,
  Bell,
  Blocks,
  CreditCard,
  Download,
  FileBarChart,
  FileText,
  Inbox,
  type LucideIcon,
  MessageSquare,
  Puzzle,
  Settings,
  StarIcon,
  Store,
  Truck,
  Upload,
  Users,
} from '@commerce/ui/icons'

/** Icon names a manifest may use, mapped to the admin icon set. */
const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Bell,
  Blocks,
  CreditCard,
  Download,
  FileBarChart,
  FileText,
  Inbox,
  MessageSquare,
  Puzzle,
  Settings,
  Star: StarIcon,
  Store,
  Truck,
  Upload,
  Users,
}

export const appIcon = (name: string | null | undefined): LucideIcon =>
  (name ? ICONS[name] : undefined) ?? Puzzle
