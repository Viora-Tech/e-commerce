'use client'

// Port of sections/product-tabs.liquid + blocks/_tab.liquid + assets/product-tabs.js: a pill tab row on wide screens, an accordion on phones, or every tab stacked under its own heading.
import { type KeyboardEvent, type ReactNode, useEffect, useState } from 'react'
import Icon from '../../icon'

export type ProductTabItem = {
  /** Handle-ised anchor or label: the panel id and the `#hash` that opens it. */
  key: string
  label: ReactNode
  panel: ReactNode
  preselected: boolean
}

type ProductTabsProps = {
  id: string
  layout: 'tabs' | 'stacked'
  ariaLabel: string
  items: ProductTabItem[]
}

const firstOpen = (items: ProductTabItem[]) =>
  (items.find((i) => i.preselected) ?? items[0])?.key ?? ''

export default function ProductTabs({ id, layout, ariaLabel, items }: ProductTabsProps) {
  // Hooks
  const [active, setActive] = useState(() => firstOpen(items))
  /** Phones: which accordion is open; null closes them all. */
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => {
    // A link to /products/x#reviews opens that tab, as the theme's anchors do.
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (hash && items.some((i) => i.key === hash)) {
      setActive(hash)
      setExpanded(hash)
    }
  }, [items])

  // Event handlers
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const at = items.findIndex((i) => i.key === active)
    const next = items[(at + step + items.length) % items.length]
    if (!next) return
    setActive(next.key)
    document.getElementById(`${id}-tab-${next.key}`)?.focus()
  }

  // Render logic
  const stacked = layout === 'stacked'

  return (
    <div className={`product-tabs${stacked ? ' product-tabs--stacked' : ''}`}>
      {stacked ? null : (
        <div className="product-tabs__tabs">
          <div
            className="product-tabs__tablist"
            role="tablist"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`${id}-tab-${item.key}`}
                className="product-tabs__tab"
                aria-selected={item.key === active}
                aria-controls={`${id}-panel-${item.key}`}
                tabIndex={item.key === active ? 0 : -1}
                onClick={() => setActive(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="product-tabs__items">
        {items.map((item) => (
          <div className="product-tabs__item" key={item.key}>
            {stacked ? <h2 className="product-tabs__static-heading h5">{item.label}</h2> : null}
            {stacked ? null : (
              <h2 className="product-tabs__accordion-heading">
                <button
                  type="button"
                  className="product-tabs__accordion"
                  aria-expanded={expanded === item.key}
                  aria-controls={`${id}-panel-${item.key}`}
                  onClick={() => setExpanded(expanded === item.key ? null : item.key)}
                >
                  <span className="product-tabs__accordion-label">{item.label}</span>
                  <Icon name="chevron-down" size={16} />
                </button>
              </h2>
            )}
            <div
              className="product-tabs__panel"
              id={`${id}-panel-${item.key}`}
              {...(stacked ? {} : { role: 'tabpanel', 'aria-labelledby': `${id}-tab-${item.key}` })}
              data-current={stacked || item.key === active ? '' : undefined}
              data-expanded={stacked || expanded === item.key ? '' : undefined}
            >
              {item.panel}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
