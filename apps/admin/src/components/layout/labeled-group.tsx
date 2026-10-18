import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type LabeledGroupProps = {
  label: ReactNode
  children: ReactNode
  className?: string
}

/** A small muted heading over its content, for the sections inside a detail card. */
export default function LabeledGroup({ label, children, className }: LabeledGroupProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
