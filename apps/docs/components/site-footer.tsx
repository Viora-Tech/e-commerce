import Link from 'next/link'
import { brand, footerLinks } from '../data/home'
import LogoMark from './logo-mark'

export default function SiteFooter() {
  // Render logic
  const year = new Date().getFullYear()

  return (
    <div className="flex w-full flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="inline-flex items-center gap-2" style={{ color: 'var(--docs-muted)' }}>
        <span style={{ color: 'var(--docs-fg)' }}>
          <LogoMark size={16} />
        </span>
        © {year} {brand.name}
      </span>
      <nav className="flex flex-wrap gap-x-6 gap-y-2">
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="no-underline transition-colors hover:text-(--docs-fg)"
            style={{ color: 'var(--docs-muted)' }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
