import { Code, Storefront } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { pathCards } from '../data/home'

const icons: Record<(typeof pathCards)[number]['icon'], ReactNode> = {
  storefront: <Storefront size={26} weight="light" />,
  code: <Code size={26} weight="light" />,
}

export default function PathCards() {
  return (
    <div className="not-prose grid gap-4 sm:grid-cols-2">
      {pathCards.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="group flex flex-col gap-3 rounded-2xl border p-6 no-underline transition-shadow hover:shadow-lg"
          style={{ borderColor: 'var(--surface-border)', boxShadow: 'var(--shadow-soft)' }}
        >
          <span
            className="flex size-11 items-center justify-center rounded-xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            {icons[card.icon]}
          </span>
          <p
            className="text-xs font-semibold tracking-wide uppercase opacity-60"
            style={{ color: 'var(--brand)' }}
          >
            {card.eyebrow}
          </p>
          <h3 className="text-xl font-semibold">{card.title}</h3>
          <p className="text-sm opacity-75">{card.description}</p>
          <span
            className="mt-1 text-sm font-medium group-hover:underline"
            style={{ color: 'var(--brand)' }}
          >
            {card.cta} →
          </span>
        </Link>
      ))}
    </div>
  )
}
