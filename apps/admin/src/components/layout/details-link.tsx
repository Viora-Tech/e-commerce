import Link from 'next/link'
import { layoutContent } from '@/data/layout'

type DetailsLinkProps = { href: string; label?: string | undefined }

/** Sheet 14:363: 96 x 32 outline pill, Primary/500 border and 16/26 label (-0.32px), 12/4 inset. */
export default function DetailsLink({ href, label = layoutContent.details }: DetailsLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 min-w-24 items-center justify-center rounded-full border border-link px-3 py-1 text-kit-label text-link transition-colors hover:bg-link-soft"
    >
      {label}
    </Link>
  )
}
