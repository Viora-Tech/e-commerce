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
import Link from 'next/link'
import { useEffect, useState } from 'react'
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
 * saved choices are read, so a dismissed card never flashes.
 */
export default function SuggestionCards({
  suggestions,
  title,
  note,
  dismissLabel,
}: SuggestionCardsProps) {
  // Hooks
  const [dismissed, setDismissed] = useState<string[] | null>(null)

  useEffect(() => {
    setDismissed(readDismissed())
  }, [])

  // Handlers
  const handleDismiss = (id: string) => {
    const next = [...(dismissed ?? []), id]
    setDismissed(next)
    writeDismissed(next)
  }

  // Render logic
  if (dismissed === null) return null
  const visible = suggestions.filter((s) => !dismissed.includes(s.id))
  if (visible.length === 0) return null

  return (
    <section className="flex flex-col gap-3.5">
      <SectionHead title={title} aside={note} />
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visible.map((s) => {
          const Icon = ICONS[s.icon]
          return (
            <li key={s.id} className="group relative flex gap-4 rounded-xl surface-card p-3.5">
              <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[0.75rem] bg-linear-to-b from-muted to-secondary text-primary">
                {s.imageUrl ? (
                  <>
                    {/* biome-ignore lint/performance/noImgElement: product photo from the store's own storage. */}
                    <img src={s.imageUrl} alt="" className="size-full object-cover" />
                  </>
                ) : (
                  <Icon className="size-8" aria-hidden="true" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1 pr-5">
                <p className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ink-strong">
                  {s.title}
                </p>
                <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                  {s.body}
                </p>
                <Link
                  href={s.href}
                  className="inline-flex items-center gap-1 pt-1.5 text-[0.8125rem] leading-[1.1875rem] font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
