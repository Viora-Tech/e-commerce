'use client'

import {
  AiIcon,
  ArrowRight,
  BadgePercent,
  type IconComponent,
  ImagePlus,
  Layers,
  Package,
  ShoppingCart,
  StarIcon,
  TrendingUp,
  Truck,
  Users,
  WhatsappLogo,
  X,
} from '@commerce/ui/icons'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SectionHead from '@/components/layout/section-head'
import { api } from '@/lib/api-client'
import { openAssistant } from '@/lib/assistant-events'
import { EASE_OUT, ENTER_SCALE, instant, layout, MOTION_MS } from '@/lib/motion'
import { useScopedStorageKey } from '@/lib/storage-scope'

export type Suggestion = {
  id: string
  /** A smart card's stored key: dismissing hides it for the whole store. Null: per browser. */
  cardKey: string | null
  icon:
    | 'stock'
    | 'cart'
    | 'whatsapp'
    | 'star'
    | 'ai'
    | 'sale'
    | 'page'
    | 'collection'
    | 'segment'
    | 'orders'
    | 'trend'
  title: string
  body: string
  cta: string
  href: string
  /** When set, the action opens Ask AI with this request instead of following `href`. */
  prompt: string | null
  /** A product photo when the suggestion is about one product. */
  imageUrl: string | null
}

type SuggestionCardsProps = {
  suggestions: Suggestion[]
  title: string
  note: string
  dismissLabel: string
  hiddenMessage: string
  undoLabel: string
}

const ICONS: Record<Suggestion['icon'], IconComponent> = {
  stock: Package,
  cart: ShoppingCart,
  whatsapp: WhatsappLogo,
  star: StarIcon,
  ai: AiIcon,
  sale: BadgePercent,
  page: ImagePlus,
  collection: Layers,
  segment: Users,
  orders: Truck,
  trend: TrendingUp,
}

/* Figma "Home · Polished": the picture tile is tinted by what the suggestion is about. */
const TONES: Record<Suggestion['icon'], string> = {
  stock: 'border-info-border bg-info-soft text-info',
  cart: 'border-warning-border bg-warning-soft text-warning',
  whatsapp: 'border-success-border bg-success-soft text-success',
  star: 'border-warning-border bg-warning-soft text-warning',
  ai: 'border-violet-border bg-violet-soft text-violet',
  sale: 'border-danger-border bg-danger-soft text-danger',
  page: 'border-info-border bg-info-soft text-info',
  collection: 'border-violet-border bg-violet-soft text-violet',
  segment: 'border-success-border bg-success-soft text-success',
  orders: 'border-warning-border bg-warning-soft text-warning',
  trend: 'border-success-border bg-success-soft text-success',
}

/** Kept per store and member: set-up ideas are about one store. */
const STORAGE_KEY = 'home-suggestions-dismissed'

/** The ids dismissed here; empty when storage is blocked, holds junk or no store is picked. */
function readDismissed(key: string | null): string[] {
  if (!key) return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(key: string | null, ids: string[]) {
  if (!key) return
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // Storage blocked: the card is hidden for this visit only.
  }
}

/**
 * The suggestion cards, two to a row. Each has a small cross: a smart card is hidden for the
 * whole store for 30 days (`dashboard.dismissCard`), a set-up idea for good in this browser
 * (localStorage; with storage blocked it only lasts the visit). Renders nothing until the
 * saved choices are read, so a dismissed card never flashes. Dismissing shrinks the card
 * out while the grid reflows, then a toast offers Undo.
 */
export default function SuggestionCards({
  suggestions,
  title,
  note,
  dismissLabel,
  hiddenMessage,
  undoLabel,
}: SuggestionCardsProps) {
  // Hooks
  const reduced = useReducedMotion()
  const key = useScopedStorageKey(STORAGE_KEY)
  const [dismissed, setDismissed] = useState<string[] | null>(null)

  useEffect(() => {
    setDismissed(readDismissed(key))
  }, [key])

  // Event handlers
  const handleRestore = (s: Suggestion) => {
    const next = (dismissed ?? []).filter((saved) => saved !== s.id)
    setDismissed(next)
    if (s.cardKey) api.dashboard.dismissCard({ key: s.cardKey, dismissed: false }).catch(() => {})
    else writeDismissed(key, next)
  }

  const handleDismiss = (s: Suggestion) => {
    const next = [...(dismissed ?? []), s.id]
    setDismissed(next)
    // Smart cards hide for the whole store (30 days); set-up ideas only in this browser.
    if (s.cardKey) api.dashboard.dismissCard({ key: s.cardKey }).catch(() => {})
    else
      writeDismissed(
        key,
        next.filter((id) => !suggestions.some((x) => x.id === id && x.cardKey)),
      )
    toast(hiddenMessage, {
      action: { label: undoLabel, onClick: () => handleRestore(s) },
    })
  }

  const handleAsk = (prompt: string) => openAssistant(prompt)

  // Early returns
  if (dismissed === null) return null

  // Render logic
  const visible = suggestions.filter((s) => !dismissed.includes(s.id))
  if (visible.length === 0) return null
  const leave = reduced ? instant : { duration: MOTION_MS.press / 1000, ease: EASE_OUT }

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead title={title} aside={note} />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AnimatePresence initial={false}>
          {visible.map((s) => {
            const Icon = ICONS[s.icon]
            return (
              <motion.li
                key={s.id}
                layout
                transition={reduced ? instant : layout}
                exit={{ scale: ENTER_SCALE, opacity: 0, transition: leave }}
                className="group/suggestion relative flex items-start gap-4 rounded-lg surface-card p-3.5 transition-shadow duration-250 ease-out hover:shadow-card-hover"
              >
                <div
                  className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-input [&_svg]:size-7 ${s.imageUrl ? 'bg-muted' : TONES[s.icon]} transition-transform duration-250 ease-out group-hover/suggestion:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/suggestion:scale-100`}
                >
                  {s.imageUrl ? (
                    <>
                      {/* biome-ignore lint/performance/noImgElement: product photo from the store's own storage. */}
                      <img src={s.imageUrl} alt="" className="size-full object-cover" />
                    </>
                  ) : (
                    <Icon className="size-7" aria-hidden="true" />
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1 pt-1 pr-7.5">
                  <p className="text-body font-semibold text-ink-strong">{s.title}</p>
                  <p className="line-clamp-2 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                    {s.body}
                  </p>
                  {s.prompt ? (
                    <button
                      type="button"
                      onClick={() => handleAsk(s.prompt ?? '')}
                      className="inline-flex items-center gap-1 pt-1.5 text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.cta}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1 pt-1.5 text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.cta}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(s)}
                  aria-label={dismissLabel}
                  title={dismissLabel}
                  className="absolute top-1.75 right-1.75 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </section>
  )
}
