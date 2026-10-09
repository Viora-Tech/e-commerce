import { ChevronLeftIcon } from '@commerce/ui/icons'
import Link from 'next/link'

type CustomersBackLinkProps = {
  href: string
  label: string
}

/** The small "‹ Customers" link above a detail page's title. */
export default function CustomersBackLink({ href, label }: CustomersBackLinkProps) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex w-fit items-center gap-0.5 rounded-md pr-1 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
