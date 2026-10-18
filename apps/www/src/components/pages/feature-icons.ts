import {
  AiIcon,
  BadgePercent,
  BarChart3,
  Blocks,
  CreditCard_ as CreditCard,
  FileText_ as FileText,
  Megaphone_ as Megaphone,
  Package_ as Package,
  Palette,
  Puzzle,
  ReceiptIcon,
  ShoppingBag,
  Truck_ as Truck,
  Users_ as Users,
} from '@commerce/ui/icons'
import type { ComponentType } from 'react'

export const FEATURE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  orders: ShoppingBag,
  products: Package,
  stock: Blocks,
  customers: Users,
  analytics: BarChart3,
  growth: Megaphone,
  discounts: BadgePercent,
  'online-store': Palette,
  content: FileText,
  apps: Puzzle,
  ai: AiIcon,
  checkout: CreditCard,
  shipping: Truck,
  gst: ReceiptIcon,
}
