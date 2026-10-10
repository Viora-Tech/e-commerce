'use client'

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { tabbedProductsContent as copy } from '../data/zero-drift/tabbed-products'
import { safeHref } from '../slot-types'
import type { CardProduct } from '../types'
import { useReducedMotion } from '../use-reduced-motion'
import ProductCard from './product-card'
import TabbedProductsHeading from './tabbed-products-heading'

type TabbedProductsProps = {
  /** A string in storage but a React node while editing on the canvas. */
  heading: ReactNode
  tabs: {
    label: string
    products: CardProduct[]
    /** Where the panel's "View all" goes (the tab's collection); no link without it. */
    href?: string | undefined
    /** Products in the tab's collection, for the optional count beside its name. */
    count?: number | undefined
  }[]
  columns?: number | undefined
  align?: 'left' | 'center' | undefined
  showCounts?: boolean | undefined
  headingFollowsTab?: boolean | undefined
}

type Indicator = { left: number; top: number; width: number; height: number }

/** Cards above this index load eagerly: the first row of the open tab. */
const EAGER_CARDS = 4

const KEY_STEP: Record<string, (current: number, total: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
}

// Port of sections/tabbed-products.liquid + assets/tabbed-products.js: one product grid under a
// row of collection tabs. Every panel is server-rendered and toggled with `hidden`; the WAI-ARIA
// tabs keyboard pattern, an ink pill that travels to the chosen tab, a heading that rolls to its
// name like an odometer, and the cards rising in again on every switch.
export default function TabbedProducts({
  heading,
  tabs,
  columns = 4,
  align = 'center',
  showCounts = false,
  headingFollowsTab = true,
}: TabbedProductsProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [roll, setRoll] = useState({ index: 0, distance: 0 })
  const [switched, setSwitched] = useState(false)
  const [indicator, setIndicator] = useState<Indicator | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    const place = () => {
      const tab = tabRefs.current[active]
      if (!tab) return
      setIndicator({
        left: tab.offsetLeft,
        top: tab.offsetTop,
        width: tab.offsetWidth,
        height: tab.offsetHeight,
      })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [active])

  // Event handlers
  const handleSelect = (index: number, focus = false) => {
    setActive(index)
    setSwitched(true)
    if (headingFollowsTab) {
      setRoll((r) => ({ index: index + 1, distance: Math.abs(index + 1 - r.index) }))
    }
    if (focus) tabRefs.current[index]?.focus()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[event.key]
    if (!step) return
    event.preventDefault()
    handleSelect(step(active, tabs.length), true)
  }

  // Early returns
  if (tabs.length === 0) return null

  // Render logic
  const labels = tabs.map((t) => t.label)
  const indicatorStyle = indicator
    ? ({
        '--ind-left': `${indicator.left}px`,
        '--ind-top': `${indicator.top}px`,
        '--ind-width': `${indicator.width}px`,
        '--ind-height': `${indicator.height}px`,
      } as React.CSSProperties)
    : undefined

  return (
    <div className={`section-tabbed-products section-tabbed-products--${align} page-width`}>
      {heading ? (
        <TabbedProductsHeading
          heading={heading}
          labels={labels}
          index={roll.index}
          distance={roll.distance}
          reduce={reduce}
        />
      ) : null}
      <div className="tabbed-products">
        <div className="tabbed-products__tabs">
          <div
            className={`tabbed-products__tablist${indicator ? ' has-indicator is-ready' : ''}`}
            role="tablist"
            onKeyDown={handleKeyDown}
          >
            {indicator ? (
              <span
                className="tabbed-products__indicator"
                aria-hidden="true"
                style={indicatorStyle}
              />
            ) : null}
            {tabs.map((t, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: tabs are an ordered list; names may repeat.
                key={i}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                type="button"
                role="tab"
                aria-selected={i === active}
                tabIndex={i === active ? 0 : -1}
                className="tabbed-products__tab"
                onClick={() => handleSelect(i)}
              >
                <span className="tabbed-products__tab-label">{t.label}</span>
                {showCounts && typeof t.count === 'number' ? (
                  <sup className="tabbed-products__tab-count" aria-hidden="true">
                    {t.count}
                  </sup>
                ) : null}
              </button>
            ))}
          </div>
        </div>
        {tabs.map((t, i) => {
          const viewAll = safeHref(t.href)
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: one panel per tab position.
              key={i}
              className={`tabbed-products__panel${switched && i === active ? ' is-entering' : ''}`}
              role="tabpanel"
              aria-label={t.label}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabs: the panel takes focus after the tablist.
              tabIndex={0}
              hidden={i !== active}
            >
              <h3 className="tabbed-products__panel-heading h4">{t.label}</h3>
              <div
                className="tabbed-products__grid"
                style={{ '--columns': columns } as React.CSSProperties}
              >
                {t.products.map((p, n) => (
                  <ProductCard key={p.id} product={p} lazy={i > 0 || n >= EAGER_CARDS} />
                ))}
              </div>
              {t.products.length === 0 ? (
                <p className="tabbed-products__empty">{copy.empty}</p>
              ) : null}
              {viewAll ? (
                <div className="tabbed-products__foot">
                  <a href={viewAll} className="btn btn--secondary">
                    {copy.viewAll}
                  </a>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
