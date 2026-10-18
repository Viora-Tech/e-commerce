import { cn } from '@commerce/ui/lib/utils'
import GlobeView from '../globe/globe-view'

type GlobeBackdropProps = { className?: string; children?: React.ReactNode }

/** The dotted globe rising from the bottom edge of a section, faded into the page. */
export default function GlobeBackdrop({ className, children }: GlobeBackdropProps) {
  return (
    <div className={cn('relative h-60 overflow-hidden md:h-[28rem]', className)}>
      <GlobeView className="absolute bottom-0 left-1/2 -translate-x-1/2" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background to-transparent"
      />
      {children}
    </div>
  )
}
