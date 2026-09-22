import Link from 'next/link'
import { layoutContent } from '@/data/layout'

type DetailsLinkProps = { href: string; label?: string | undefined }

/** Sheet 14:363: 96 x 32; secondary radius-8 button instead of the indigo pill (Kuldeep). */
export default function DetailsLink({ href, label = layoutContent.details }: DetailsLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 min-w-24 items-center justify-center rounded-lg border border-border bg-card px-3 py-1 text-kit-label text-ink-strong shadow-lift transition-colors hover:bg-background"
    >
      {label}
    </Link>
  )
}
