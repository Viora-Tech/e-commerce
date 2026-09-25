import {
  CreditCard,
  Package,
  Palette,
  Receipt,
  SquaresFour,
  Truck,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { popularGuides } from '../data/home'

const icons: Record<(typeof popularGuides)[number]['icon'], ReactNode> = {
  truck: <Truck size={20} weight="light" />,
  package: <Package size={20} weight="light" />,
  palette: <Palette size={20} weight="light" />,
  receipt: <Receipt size={20} weight="light" />,
  card: <CreditCard size={20} weight="light" />,
  apps: <SquaresFour size={20} weight="light" />,
}

export default function GuideGrid() {
  return (
    <div className="not-prose grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {popularGuides.map((guide) => (
        <Link
          key={guide.href}
          href={guide.href}
          className="flex items-start gap-3 rounded-xl border p-4 no-underline transition-colors hover:border-current"
          style={{ borderColor: 'var(--surface-border)' }}
        >
          <span
            className="flex size-9 flex-none items-center justify-center rounded-lg"
            style={{ background: 'var(--surface-muted)', color: 'var(--brand)' }}
          >
            {icons[guide.icon]}
          </span>
          <span>
            <span className="block text-sm font-medium">{guide.title}</span>
            <span className="block text-sm opacity-65">{guide.description}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
