import { cn } from '@commerce/ui/lib/utils'
import { FieldDescription, FieldLegend, FieldSet } from '@commerce/ui/shadcn/field'
import type { ReactNode } from 'react'

type OptionSectionProps = {
  title: string
  help?: string | undefined
  children: ReactNode
  className?: string
}

/**
 * One named group of an option's settings inside a card ("What the shopper pays", "Which
 * couriers show", "Insurance and cash on delivery"), with a hairline above every group but the
 * first, so a card reads as a few plain sections instead of one long list.
 */
export default function OptionSection({ title, help, children, className }: OptionSectionProps) {
  return (
    <FieldSet className={cn('gap-3 border-hairline not-first:border-t not-first:pt-4', className)}>
      <FieldLegend variant="label" className="mb-0 text-ink-strong">
        {title}
      </FieldLegend>
      {help ? <FieldDescription className="-mt-2">{help}</FieldDescription> : null}
      {children}
    </FieldSet>
  )
}
