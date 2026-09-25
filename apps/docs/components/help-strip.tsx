import { Lifebuoy } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { helpStrip } from '../data/home'

export default function HelpStrip() {
  return (
    <div
      className="not-prose flex flex-col items-start gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: 'var(--surface-border)', background: 'var(--surface-muted)' }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 flex-none items-center justify-center rounded-xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          <Lifebuoy size={20} weight="light" />
        </span>
        <div>
          <p className="font-semibold">{helpStrip.title}</p>
          <p className="text-sm opacity-70">{helpStrip.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {helpStrip.links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border px-4 py-2 text-sm font-medium no-underline"
            style={{ borderColor: 'var(--surface-border)' }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
