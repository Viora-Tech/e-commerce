import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type TiltCardProps = { children: ReactNode; className?: string }

/**
 * A card that leans toward the cursor. It reads `--px` and `--py` (-1 to 1), which the hero sets
 * on its section while the pointer moves, so one listener drives every layer.
 */
export default function TiltCard({ children, className }: TiltCardProps) {
  return (
    <div
      className={cn(
        '[transform:perspective(70rem)_rotateY(calc(var(--px,0)*3.5deg))_rotateX(calc(var(--py,0)*-2.5deg))] transition-transform duration-300 ease-(--ease-out) motion-reduce:transform-none',
        className,
      )}
    >
      {children}
    </div>
  )
}
