import Link from 'next/link'
import { layoutContent } from '@/data/layout'

type DetailsLinkProps = { href: string; label?: string | undefined }

/** 5:1509: 96 x 32 outline pill in the link colour, 16/26 label. */
export default function DetailsLink({ href, label = layoutContent.details }: DetailsLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 min-w-24 items-center justify-center rounded-full border border-link px-6 text-kit-label text-link transition-colors hover:bg-link-soft"
    >
      {label}
    </Link>
  )
}
