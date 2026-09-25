import {
  Code,
  CreditCard,
  PaintBrush,
  Plugs,
  PuzzlePiece,
  Receipt,
  Storefront,
  Truck,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { type HomeCardIcon, pathCards, popularGuides } from '../data/home'

type HomeCardsProps = {
  group: 'paths' | 'guides'
}

const icons = {
  storefront: Storefront,
  code: Code,
  plugs: Plugs,
  truck: Truck,
  paintbrush: PaintBrush,
  receipt: Receipt,
  creditCard: CreditCard,
  puzzle: PuzzlePiece,
} satisfies Record<HomeCardIcon, unknown>

/** Home-page card grid: icon, title and one line per card. */
export default function HomeCards({ group }: HomeCardsProps) {
  const cards = group === 'paths' ? pathCards : popularGuides

  return (
    <div
      className={`not-prose mt-6 grid gap-4 sm:grid-cols-2 ${group === 'guides' ? 'lg:grid-cols-3' : ''}`}
    >
      {cards.map((card) => {
        const Icon = icons[card.icon]
        return (
          <Link
            key={card.href}
            href={card.href}
            className="docs-home-card group flex flex-col gap-3 rounded-xl border p-5 no-underline transition-colors"
          >
            <span className="docs-home-card-icon inline-flex size-9 items-center justify-center rounded-lg">
              <Icon size={20} weight="light" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[0.9375rem] font-semibold tracking-tight text-(--docs-fg)">
                {card.title}
              </span>
              <span className="text-sm leading-relaxed text-(--docs-muted)">
                {card.description}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}
