'use client'

import { AiIcon, Clock, Moon, ShoppingBag } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { type ReactNode, useEffect, useRef } from 'react'
import CustomerAvatar from '@/components/customers/customer-avatar'
import OrderChip from '@/components/orders/order-chip'
import { paletteContent } from '@/data/command-palette'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { PaletteRow as Row } from '@/lib/palette-rows'
import PaletteHighlight from './palette-highlight'

type PaletteRowProps = {
  row: Row
  query: string
  /** The DOM id the combobox points at with aria-activedescendant. */
  optionId: string
  active: boolean
  onHover: () => void
  onActivate: (newTab: boolean) => void
}

const TILE =
  'flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground [&_svg]:size-[1.125rem]'

function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={cn(TILE, className)}>
      {children}
    </span>
  )
}

function Thumb({ src, fallback }: { src: string | null; fallback: ReactNode }) {
  return (
    <Tile>
      {src ? (
        // biome-ignore lint/performance/noImgElement: store media URLs are already sized and hosted by us
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        fallback
      )}
    </Tile>
  )
}

/** Two lines of text, the second one quiet. */
function Lines({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-[0.9375rem] leading-5 text-foreground">{title}</span>
      {sub ? (
        <span className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-caption text-muted-foreground">
          {sub}
        </span>
      ) : null}
    </span>
  )
}

function Trailing({ children }: { children?: ReactNode }) {
  return (
    <span className="ml-auto flex shrink-0 items-center gap-2 pl-2 text-body text-muted-foreground tabular-nums">
      {children}
    </span>
  )
}

function EnterHint() {
  return (
    <Kbd className="hidden bg-glass-active text-glass-active-ink group-data-[active=true]:inline-flex">
      ↵
    </Kbd>
  )
}

function RowBody({ row, query }: { row: Row; query: string }) {
  // Hooks
  const copy = useCopy(paletteContent)
  const fmt = useFormat()

  // Render logic
  switch (row.kind) {
    case 'ask':
      return (
        <>
          <Tile className="bg-primary-soft text-primary">
            <AiIcon />
          </Tile>
          <Lines title={copy.askAi(row.query)} sub={copy.askAiHint} />
          <Trailing>
            <EnterHint />
          </Trailing>
        </>
      )
    case 'recent':
      return (
        <>
          <Tile>
            <Clock />
          </Tile>
          <Lines title={row.entry.label} sub={row.entry.hint} />
        </>
      )
    case 'action':
    case 'page':
    case 'setting':
      return (
        <>
          <Tile>
            <row.icon />
          </Tile>
          <Lines
            title={<PaletteHighlight text={row.label} query={query} />}
            sub={row.hint ? <PaletteHighlight text={row.hint} query={query} /> : undefined}
          />
          <Trailing>
            {row.shortcut ? (
              <span className="flex items-center gap-1 group-data-[active=true]:hidden">
                {row.shortcut.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            ) : null}
            <EnterHint />
          </Trailing>
        </>
      )
    case 'theme':
      return (
        <>
          <Tile>
            <Moon />
          </Tile>
          <Lines title={row.label} />
        </>
      )
    case 'order':
      return (
        <>
          <Thumb src={row.hit.imageUrl} fallback={<ShoppingBag />} />
          <Lines
            title={
              <>
                <span className="font-semibold">
                  <PaletteHighlight text={`#${row.hit.number}`} query={query} />
                </span>{' '}
                <PaletteHighlight text={row.hit.customerName ?? copy.order.guest} query={query} />
              </>
            }
            sub={
              <>
                <OrderChip kind="order" value={row.hit.status} />
                <span className="truncate">{fmt.date(row.hit.placedAt)}</span>
              </>
            }
          />
          <Trailing>{fmt.money(row.hit.totalPaise)}</Trailing>
        </>
      )
    case 'product': {
      const { hit } = row
      const price =
        hit.minPricePaise === null
          ? null
          : hit.minPricePaise === hit.maxPricePaise
            ? fmt.money(hit.minPricePaise)
            : copy.product.from(fmt.money(hit.minPricePaise))
      return (
        <>
          <Thumb src={hit.imageUrl} fallback={<ShoppingBag />} />
          <Lines
            title={<PaletteHighlight text={hit.title} query={query} />}
            sub={
              <>
                <OrderChip kind="product" value={hit.status} />
                <span className="truncate">
                  {hit.available > 0
                    ? copy.product.inStock(hit.available)
                    : copy.product.outOfStock}
                </span>
              </>
            }
          />
          <Trailing>{price}</Trailing>
        </>
      )
    }
    case 'customer': {
      const { hit } = row
      const contact = hit.email ?? hit.phone ?? ''
      return (
        <>
          <CustomerAvatar name={hit.name} email={hit.email} className="size-9" />
          <Lines
            title={<PaletteHighlight text={hit.name} query={query} />}
            sub={contact ? <PaletteHighlight text={contact} query={query} /> : undefined}
          />
          <Trailing>
            {hit.orderCount > 0 ? copy.customer.orders(hit.orderCount) : copy.customer.noOrders}
          </Trailing>
        </>
      )
    }
    case 'more':
      return <span className="flex-1 pl-12 text-body-strong text-primary">{row.label}</span>
  }
}

/** One option in the palette list: the same shell for every kind, the body by kind. */
export default function PaletteRow({
  row,
  query,
  optionId,
  active,
  onHover,
  onActivate,
}: PaletteRowProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled by the combobox input (aria-activedescendant)
    <div
      ref={ref}
      role="option"
      tabIndex={-1}
      id={optionId}
      aria-selected={active}
      data-active={active}
      onMouseMove={onHover}
      onClick={(e) => onActivate(e.metaKey || e.ctrlKey)}
      className="group flex cursor-default items-center gap-3 rounded-xl px-3 py-2 data-[active=true]:bg-glass-active"
    >
      <RowBody row={row} query={query} />
    </div>
  )
}
