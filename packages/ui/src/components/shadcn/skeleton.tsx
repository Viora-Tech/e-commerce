import { cn } from '../../lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  // changed bg-accent to bg-secondary/80
  return (
    <div
      className={cn('animate-pulse rounded-md bg-secondary/80', className)}
      data-slot="skeleton"
      {...props}
    />
  )
}

export { Skeleton }
