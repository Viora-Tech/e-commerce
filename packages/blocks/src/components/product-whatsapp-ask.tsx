import type { ReactNode } from 'react'
import Icon from './icon'

type ProductWhatsappAskProps = {
  /** wa.me link with the product in the message; null draws nothing. */
  href: string | null
  label: ReactNode
}

// The `whatsapp_ask` block of sections/main-product.liquid: one link to ask about this product.
export default function ProductWhatsappAsk({ href, label }: ProductWhatsappAskProps) {
  // Early returns
  if (!href) return null

  return (
    <a className="whatsapp-ask" href={href} target="_blank" rel="noopener">
      <Icon name="whatsapp" size={20} />
      <span>{label}</span>
    </a>
  )
}
