import { cn } from '@commerce/ui/lib/utils'

type CustomerAvatarProps = {
  name: string | null
  email: string | null
  className?: string
}

/** Two letters from the name, or the first of the email, on a soft green disc. */
export function initials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || ''
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/** Frame 5:2488 style picture slot, filled with initials since shoppers have no photo. */
export function CustomerAvatar({ name, email, className }: CustomerAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary',
        className,
      )}
    >
      {initials(name, email)}
    </span>
  )
}
