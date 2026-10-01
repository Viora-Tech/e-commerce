import { cn } from '@commerce/ui/lib/utils'
import { initials } from '@/lib/initials'

type CustomerAvatarProps = {
  name: string | null
  email: string | null
  className?: string
}

/** Frame 5:2488 style picture slot, filled with initials since shoppers have no photo. */
export default function CustomerAvatar({ name, email, className }: CustomerAvatarProps) {
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
