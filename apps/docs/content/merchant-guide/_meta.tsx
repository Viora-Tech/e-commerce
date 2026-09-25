import {
  ClipboardText,
  CreditCard,
  Package,
  Receipt,
  Rocket,
  ShieldCheck,
  SquaresFour,
  Storefront,
  Truck,
} from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'

function navItem(icon: ReactNode, label: string) {
  return {
    title: (
      <span className="docs-nav-item">
        {icon}
        {label}
      </span>
    ),
  }
}

const iconProps = { size: 16, weight: 'light' as const }

export default {
  index: navItem(<Rocket {...iconProps} />, 'Getting started'),
  'sep-catalog': { type: 'separator', title: 'Catalog & orders' },
  'products-collections': navItem(<Package {...iconProps} />, 'Products and collections'),
  orders: navItem(<ClipboardText {...iconProps} />, 'Orders'),
  'sep-fulfil': { type: 'separator', title: 'Fulfilment & storefront' },
  shipments: navItem(<Truck {...iconProps} />, 'Shipments'),
  'online-store': navItem(<Storefront {...iconProps} />, 'Online store'),
  apps: navItem(<SquaresFour {...iconProps} />, 'Apps'),
  'sep-money': { type: 'separator', title: 'Money & compliance' },
  'gst-invoices': navItem(<Receipt {...iconProps} />, 'GST invoices'),
  payments: navItem(<CreditCard {...iconProps} />, 'Payments'),
  security: navItem(<ShieldCheck {...iconProps} />, 'Security and data protection'),
}
