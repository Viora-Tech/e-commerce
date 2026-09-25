import Link from 'next/link'
import { helpStrip } from '../data/home'

export default function HelpStrip() {
  return (
    <p className="not-prose mt-4 text-base leading-7" style={{ color: 'var(--docs-muted)' }}>
      {helpStrip.description}{' '}
      {helpStrip.links.map((link, index) => (
        <span key={link.href}>
          {index > 0 && ' or '}
          <Link
            href={link.href}
            className="font-medium no-underline hover:underline"
            style={{ color: 'var(--docs-link)' }}
          >
            {link.label}
          </Link>
        </span>
      ))}
      .
    </p>
  )
}
