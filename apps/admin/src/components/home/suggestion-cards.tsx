'use client'

import {
  AiIcon,
  ArrowRight,
  BadgePercent,
  type IconComponent,
  Package,
  ShoppingCart,
  StarIcon,
  WhatsappLogo,
  X,
} from '@commerce/ui/icons'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EASE_OUT, ENTER_SCALE, instant, layout, MOTION_MS } from '@/lib/motion'
import SectionHead from './section-head'

export type Suggestion = {
  id: string
  icon: 'stock' | 'cart' | 'whatsapp' | 'star' | 'ai' | 'sale'
  title: string
  body: string
  cta: string
  href: string
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
}

const STORAGE_KEY = 'home-suggestions-dismissed'

/** The ids this browser has dismissed; empty when storage is blocked or holds junk. */
function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage blocked: the card is hidden for this visit only.
  }
}

/**
 * The 2x2 suggestion cards. Each has a small cross that hides it for good in this browser
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
  const [dismissed, setDismissed] = useState<string[] | null>(null)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  // Event handlers
  const handleRestore = (id: string) => {
    const next = (dismissed ?? []).filter((saved) => saved !== id)
    setDismissed(next)
    writeDismissed(next)
  }

  const handleDismiss = (id: string) => {
    const next = [...(dismissed ?? []), id]
    setDismissed(next)
    writeDismissed(next)
    toast(hiddenMessage, {
      action: { label: undoLabel, onClick: () => handleRestore(id) },
    })
  }

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
                <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground shadow-input transition-transform duration-250 ease-out group-hover/suggestion:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/suggestion:scale-100">
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
                  <Link
                    href={s.href}
                    className="inline-flex items-center gap-1 pt-1.5 text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s.cta}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(s.id)}
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
