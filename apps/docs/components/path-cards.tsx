import { ArrowRight } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { pathCards } from '../data/home'

export default function PathCards() {
  return (
    <div className="not-prose mt-6 grid gap-4 sm:grid-cols-2">
      {pathCards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group flex flex-col gap-2 rounded-lg border p-5 no-underline transition-colors hover:border-(--docs-border-strong) hover:bg-(--docs-surface)"
          style={{ borderColor: 'var(--docs-border)' }}
        >
          <span className="text-[0.8125rem]" style={{ color: 'var(--docs-muted)' }}>
            {card.eyebrow}
          </span>
          <span
            className="flex items-center justify-between gap-2 text-base font-semibold tracking-tight"
            style={{ color: 'var(--docs-fg)' }}
          >
            {card.title}
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
              style={{ color: 'var(--docs-muted)' }}
            />
          </span>
          <span className="text-sm leading-relaxed" style={{ color: 'var(--docs-muted)' }}>
            {card.description}
          </span>
        </Link>
      ))}
    </div>
  )
}
