import Link from 'next/link'
import { popularGuides } from '../data/home'

export default function GuideGrid() {
  return (
    <div className="not-prose mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {popularGuides.map((guide) => (
        <Link
          key={guide.href}
          href={guide.href}
          className="flex flex-col gap-1.5 rounded-lg border p-4 no-underline transition-colors hover:border-(--docs-border-strong) hover:bg-(--docs-surface)"
          style={{ borderColor: 'var(--docs-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--docs-fg)' }}>
            {guide.title}
          </span>
          <span className="text-sm leading-relaxed" style={{ color: 'var(--docs-muted)' }}>
            {guide.description}
          </span>
        </Link>
      ))}
    </div>
  )
}
