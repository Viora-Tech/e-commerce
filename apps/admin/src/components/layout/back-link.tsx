import { ChevronLeftIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'

type BackLinkProps = {
  label: string
  className?: string
} & (
  | { href: string; onClick?: never }
  /** In-page back (a settings row's detail closing): a button, not a link. */
  | { onClick: () => void; href?: never }
)

const CLASS =
  'inline-flex w-fit items-center gap-1 rounded-md text-body text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** The "‹ Orders" link above a page title that leads back to the parent list. */
export default function BackLink({ href, onClick, label, className }: BackLinkProps) {
  // Early returns
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(CLASS, className)}>
        <ChevronLeftIcon className="size-4" aria-hidden />
        {label}
      </button>
    )
  }

  // Render logic
  return (
    <Link href={href ?? '/'} className={cn(CLASS, className)}>
      <ChevronLeftIcon className="size-4" aria-hidden />
      {label}
    </Link>
  )
}
