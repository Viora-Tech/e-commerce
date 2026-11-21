import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useId } from 'react'

type OptionSectionProps = {
  title: string
  help?: string | undefined
  children: ReactNode
  className?: string
}

/**
 * One named group of an option's settings inside a card ("What the shopper pays", "Which
 * couriers show", "Insurance and cash on delivery"), with a hairline above every group but the
 * first, so a card reads as a few plain sections instead of one long list. A plain heading, not a
 * fieldset legend: the browser draws a legend on the fieldset's border, which put the title on
 * top of its help line (owner, 21 Nov 2026).
 */
export default function OptionSection({ title, help, children, className }: OptionSectionProps) {
  // Hooks
  const id = useId()

  return (
    <section
      aria-labelledby={id}
      className={cn(
        'flex flex-col gap-3 border-hairline not-first:border-t not-first:pt-4',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="text-label font-medium text-ink-strong">
          {title}
        </h3>
        {help ? <p className="text-caption text-muted-foreground">{help}</p> : null}
      </div>
      {children}
    </section>
  )
}
