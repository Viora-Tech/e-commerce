import type { ReactNode } from 'react'
import { hasCopy } from '../sections/main-product-settings'
import Icon, { type IconName } from './icon'

type ProductNoteLineProps = {
  icon: IconName
  text: ReactNode
  /** `returns-line` for the returns block; the dispatch line takes the base look only. */
  className?: string | undefined
}

// One icon + sentence row in the buy box, the markup the theme's `delivery_estimate` text
// and `returns_line` blocks share (`.delivery-estimate` with `.delivery-estimate__text`).
export default function ProductNoteLine({ icon, text, className }: ProductNoteLineProps) {
  // Early returns
  if (!hasCopy(text)) return null

  return (
    <div className={`delivery-estimate${className ? ` ${className}` : ''}`}>
      <span className="delivery-estimate__icon">
        <Icon name={icon} size={20} />
      </span>
      <div className="delivery-estimate__text">{text}</div>
    </div>
  )
}
