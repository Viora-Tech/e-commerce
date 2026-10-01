import type { ReactNode } from 'react'
import { hasCopy } from '../sections/main-product-settings'
import Icon from './icon'

type ProductAssuranceProps = {
  /** The returns sentence that applies (the pre-order one on a pre-order). */
  returns: ReactNode
  cod: ReactNode
  whatsappHref: string | null
  whatsappLabel: ReactNode
}

// The `assurance` block of sections/main-product.liquid: the reassurance tier as one quiet
// list (returns, cash on delivery, a way to ask), in place of three stacked blocks.
export default function ProductAssurance({
  returns,
  cod,
  whatsappHref,
  whatsappLabel,
}: ProductAssuranceProps) {
  // Early returns
  if (!hasCopy(returns) && !hasCopy(cod) && !whatsappHref) return null

  return (
    <ul className="assurance">
      {hasCopy(returns) ? (
        <li className="assurance__item">
          <span className="assurance__icon">
            <Icon name="shield" size={18} />
          </span>
          <span>{returns}</span>
        </li>
      ) : null}
      {hasCopy(cod) ? (
        <li className="assurance__item">
          <span className="assurance__icon">
            <Icon name="payment" size={18} />
          </span>
          <span>{cod}</span>
        </li>
      ) : null}
      {whatsappHref ? (
        <li className="assurance__item">
          <a className="assurance__link" href={whatsappHref} target="_blank" rel="noopener">
            <span className="assurance__icon">
              <Icon name="whatsapp" size={18} />
            </span>
            <span>{whatsappLabel}</span>
            <Icon name="arrow" size={14} />
          </a>
        </li>
      ) : null}
    </ul>
  )
}
