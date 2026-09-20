'use client'

import { useState } from 'react'
import type { CardProduct } from '../types'
import { ProductCard } from './product-card'

// Port of sections/tabbed-products.liquid. Tabs are product types.
export function TabbedProducts({
  heading,
  tabs,
  columns = 4,
}: {
  heading: string
  tabs: { label: string; products: CardProduct[] }[]
  columns?: number
}) {
  const [active, setActive] = useState(0)
  const current = tabs[active] ?? tabs[0]
  if (!current) return null

  return (
    <div className="section-tabbed-products section-tabbed-products--center page-width">
      <h2 className="tabbed-products__heading h2">
        <span className="visually-hidden">{heading}</span>
        <span className="tabbed-products__heading-roll" aria-hidden="true">
          <span className="tabbed-products__heading-item">{heading}</span>
        </span>
      </h2>
      <div className="tabbed-products">
        <div className="tabbed-products__tabs">
          <div className="tabbed-products__tablist" role="tablist">
            {tabs.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={i === active}
                className="tabbed-products__tab"
                onClick={() => setActive(i)}
              >
                <span className="tabbed-products__tab-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="tabbed-products__panel" role="tabpanel">
          <div
            className="tabbed-products__grid"
            style={{ '--columns': columns } as React.CSSProperties}
          >
            {current.products.map((p, i) => (
              <ProductCard key={p.id} product={p} lazy={i > 3} />
            ))}
          </div>
          {current.products.length === 0 ? (
            <p className="tabbed-products__empty">Nothing here yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
