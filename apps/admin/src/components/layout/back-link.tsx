import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'

type BackLinkProps = {
  href: string
  label: string
  className?: string
}

/** The "‹ Orders" link above a page title that leads back to the parent list. */
export default function BackLink({ href, label, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-md text-body text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <ChevronLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
