import Link from 'next/link'
import { layoutContent } from '@/data/layout'

type DetailsLinkProps = { href: string; label?: string | undefined }

/** 5:1509: 96 x 32 outline pill in the link colour, 16px label. */
export function DetailsLink({ href, label = layoutContent.details }: DetailsLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 min-w-24 items-center justify-center rounded-full border border-link px-6 text-[0.8125rem] leading-5  text-link transition-colors hover:bg-link-soft"
    >
      {label}
    </Link>
  )
}
