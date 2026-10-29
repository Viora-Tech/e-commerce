import { ArrowRight } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { siteContent } from '@/data/site'
import { ctaClass } from '@/lib/cta'

type StartFreeButtonProps = {
  size?: 'sm' | 'md' | 'lg'
  arrow?: boolean
  /** `cta` is the orange primary; `outline` is the dark secondary used on non-featured plans. */
  variant?: 'cta' | 'outline'
  className?: string
  children?: ReactNode
}

/** Every "Start free" button goes to the admin sign-in, which creates the account and the store. */
export default function StartFreeButton({
  size = 'md',
  arrow = false,
  variant = 'cta',
  className,
  children,
}: StartFreeButtonProps) {
  // Render logic
  const classes =
    variant === 'cta'
      ? ctaClass(size, className)
      : buttonVariants({ variant: 'outline', size: 'lg', className })

  return (
    <a href={siteContent.startFree.href} className={classes}>
      {children ?? siteContent.startFree.label}
      {arrow ? <ArrowRight aria-hidden /> : null}
    </a>
  )
}
