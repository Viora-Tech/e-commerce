import type { ReactNode } from 'react'
import { TABBED_PRODUCTS } from '../data/zero-drift/tabbed-products'

type TabbedProductsHeadingProps = {
  /** A string in storage but a React node while editing on the canvas. */
  heading: ReactNode
  /** Every tab's name, in order; the strip rolls through them. */
  labels: string[]
  /** 0 is the section's own heading, 1.. the tabs. */
  index: number
  /** How far the strip travelled to get here, which sets the roll's duration. */
  distance: number
  reduce: boolean
}

// The odometer heading of sections/tabbed-products.liquid: a strip of the heading and every tab
// name that slides to the chosen one, so a jump of several tabs rolls through the names in
// between. The strip is aria-hidden; the visually hidden copy beside it is the real name.
export default function TabbedProductsHeading({
  heading,
  labels,
  index,
  distance,
  reduce,
}: TabbedProductsHeadingProps) {
  // Render logic
  const duration = Math.min(
    TABBED_PRODUCTS.rollMaxMs,
    TABBED_PRODUCTS.rollBaseMs + distance * TABBED_PRODUCTS.rollStepMs,
  )
  const style = {
    transform: `translateY(calc(var(--tp-line, 1.2em) * ${-index}))`,
    ...(reduce || distance === 0 ? {} : { transitionDuration: `${duration}ms` }),
  }

  return (
    <h2 className="tabbed-products__heading h2">
      {/* While the heading is being typed on the canvas it is drawn once, in the strip. */}
      <span className="visually-hidden">
        {index > 0 ? labels[index - 1] : typeof heading === 'string' ? heading : null}
      </span>
      <span className="tabbed-products__heading-roll" aria-hidden="true" style={style}>
        <span className="tabbed-products__heading-item">{heading}</span>
        {labels.map((label, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one strip item per tab position; names may repeat.
          <span key={i} className="tabbed-products__heading-item">
            {label}
          </span>
        ))}
      </span>
    </h2>
  )
}
