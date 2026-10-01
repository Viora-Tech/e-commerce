import type { ReactNode } from 'react'
import { hasCopy } from '../sections/main-product-settings'
import Icon, { isIconName } from './icon'

type ProductTrustBadgesProps = {
  badges: { icon: string; label: ReactNode }[]
  /** Pre-order, launch or sold out: a dispatch promise would be untrue, so it stands down. */
  noDispatch: boolean
  /** wa.me link for the "Ask us" cell; null leaves the cell out. */
  whatsappHref: string | null
  whatsappLabel: ReactNode
}

/** Free-text badges are matched on the words a same-day-dispatch badge is written with. */
const DISPATCH_WORDS = /dispatch|ships/i

const shown = (label: ReactNode, noDispatch: boolean) =>
  hasCopy(label) && !(noDispatch && typeof label === 'string' && DISPATCH_WORDS.test(label))

// The `trust_badges` block of sections/main-product.liquid: a ruled two-column grid of
// icon + label cells, the WhatsApp "Ask us" cell last (an odd count lets it run full width).
export default function ProductTrustBadges({
  badges,
  noDispatch,
  whatsappHref,
  whatsappLabel,
}: ProductTrustBadgesProps) {
  // Early returns
  const visible = badges.filter((b) => shown(b.label, noDispatch))
  if (visible.length === 0 && !whatsappHref) return null

  return (
    <div className="trust-badges">
      {visible.map((b, i) => (
        // Labels may be editor nodes, so the position keys the cell.
        // biome-ignore lint/suspicious/noArrayIndexKey: badges are an ordered settings list.
        <div key={i} className="trust-badges__item">
          <span className="trust-badges__icon">
            <Icon name={isIconName(b.icon) ? b.icon : 'check'} size={20} />
          </span>
          <span className="trust-badges__label">{b.label}</span>
        </div>
      ))}
      {whatsappHref ? (
        <a
          className="trust-badges__item trust-badges__item--ask"
          href={whatsappHref}
          target="_blank"
          rel="noopener"
        >
          <span className="trust-badges__icon">
            <Icon name="whatsapp" size={20} />
          </span>
          <span className="trust-badges__label">{whatsappLabel}</span>
          <Icon name="arrow" size={14} />
        </a>
      ) : null}
    </div>
  )
}
