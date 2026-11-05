import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'

type ChartLoadingProps = { className?: string }

/** Fills the fixed-height frame a chart sits in until its code arrives, so nothing moves. */
export default function ChartLoading({ className }: ChartLoadingProps) {
  return <Skeleton className={cn('size-full', className)} />
}
