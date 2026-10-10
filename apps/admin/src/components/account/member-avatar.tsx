import { cn } from '@commerce/ui/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@commerce/ui/shadcn/avatar'
import { initials } from '@/lib/initials'

type MemberAvatarProps = {
  name: string | null
  email?: string | null | undefined
  /** The member's photo (Account → Profile); initials show until it loads, or when there is none. */
  image?: string | null | undefined
  /** Size and placement of the disc, e.g. `size-9`. */
  className?: string | undefined
  /** Colours and type of the initials disc. */
  fallbackClassName?: string | undefined
}

/**
 * A team member's photo, or their initials when they have none or it fails to load. One
 * component for the top bar, the sidebar's user row, the staff list and the Profile page, so
 * a member looks the same everywhere.
 */
export default function MemberAvatar({
  name,
  email = null,
  image,
  className,
  fallbackClassName,
}: MemberAvatarProps) {
  return (
    <Avatar className={cn('after:hidden', className)}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback className={cn('font-semibold', fallbackClassName)}>
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  )
}
