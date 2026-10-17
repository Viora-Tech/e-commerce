'use client'

import { ArrowRight } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { siteContent } from '@/data/site'
import { ctaClass } from '@/lib/cta'
import { useWaitlist } from './waitlist-context'

type JoinWaitlistButtonProps = {
  size?: 'sm' | 'md' | 'lg'
  arrow?: boolean
  /** `cta` is the orange primary; `outline` is the dark secondary used on non-featured plans. */
  variant?: 'cta' | 'outline'
  className?: string
  children?: ReactNode
}

/** Every "Join the waitlist" button opens the same modal (desktop) or bottom sheet (phone). */
export default function JoinWaitlistButton({
  size = 'md',
  arrow = false,
  variant = 'cta',
  className,
  children,
}: JoinWaitlistButtonProps) {
  // Hooks
  const { openWaitlist } = useWaitlist()

  // Render logic
  const classes =
    variant === 'cta'
      ? ctaClass(size, className)
      : buttonVariants({ variant: 'outline', size: 'lg', className })

  const button = (
    <button type="button" className={classes} onClick={() => openWaitlist()}>
      {children ?? siteContent.joinWaitlist}
      {arrow ? <ArrowRight aria-hidden /> : null}
    </button>
  )

  return button
}
