import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type SetupStepRowProps = {
  title: string
  detail: string
  done: boolean
  /** Words for screen readers: "Done" or "Not done yet". */
  stateLabel: string
  /** The step's one button, while it still needs doing. */
  action?: ReactNode
}

/**
 * One step of the WhatsApp setup card (Figma 928:12061): a 1.25rem circle, filled green once the
 * step is done, its title and one grey line, and the button that does it on the right.
 */
export default function SetupStepRow({
  title,
  detail,
  done,
  stateLabel,
  action,
}: SetupStepRowProps) {
  return (
    <li className="flex items-center gap-3 border-panel-border border-t px-4 py-3.5">
      <span
        className={cn(
          'size-5 shrink-0 rounded-full',
          done ? 'bg-success' : 'border border-muted-foreground/50',
        )}
      >
        <span className="sr-only">{stateLabel}</span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn('text-body', done ? 'text-muted-foreground' : 'text-foreground')}>
          {title}
        </p>
        <p className="text-caption text-muted-foreground">{detail}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </li>
  )
}
