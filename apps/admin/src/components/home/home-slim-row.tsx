import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { CHIP_DOT, type ChipTone } from '@/components/status/tone'
import { SLIM_ROW } from './home-layout'

type HomeSlimRowProps = {
  /** The coloured dot at the start; ignored when `icon` is set. */
  tone?: ChipTone
  /** A small icon in place of the dot (the monthly goal). */
  icon?: ReactNode
  /** The bold words: "Store health · 2 to fix". */
  lead: ReactNode
  /** The plain words after it. */
  text?: ReactNode
  /** The lead on its own line above the text (the monthly goal) instead of running into it. */
  stacked?: boolean
  /** The one button on the right. */
  action?: ReactNode
  className?: string
}

/**
 * One slim full-width row (Figma "Home · Redesign 19 Nov" 1044:11219): a dot or icon, a bold
 * lead and one plain line, one button on the right. Store health, the old to-ship orders and the
 * monthly goal use it, so they read as notes rather than more cards.
 */
export default function HomeSlimRow({
  tone = 'neutral',
  icon,
  lead,
  text,
  stacked = false,
  action,
  className,
}: HomeSlimRowProps) {
  // Render logic
  return (
    <div className={cn(SLIM_ROW, className)}>
      {icon ? (
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : (
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', CHIP_DOT[tone])} />
      )}
      {stacked ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-body-strong text-ink-strong">{lead}</p>
          {text ? <p className="text-caption text-muted-foreground">{text}</p> : null}
        </div>
      ) : (
        <p className="min-w-0 flex-1 text-caption text-muted-foreground">
          <span className="font-semibold text-ink-strong">{lead}</span>
          {text ? <> {text}</> : null}
        </p>
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
