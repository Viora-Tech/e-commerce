'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { rapidshypAppContent as appCopy } from '@/data/rapidshyp'

type ConnectAdvancedFieldsProps = {
  baseUrl: string
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = appCopy.connect.advanced

/** The one rarely-touched field: a manual base URL override. Collapsed by default so the
 *  guided fields above stay the whole story for a merchant who only needs the basics.
 *  No webhook fields here yet: RapidShyp's webhook payload shape could not be confirmed
 *  against fetchable docs, so it isn't wired (see packages/shipping-rapidshyp/src/rapidshyp.ts). */
export default function ConnectAdvancedFields({
  baseUrl,
  onField,
  open,
  onOpenChange,
}: ConnectAdvancedFieldsProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {copy.trigger}
        <ChevronDown
          aria-hidden="true"
          className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FieldGroup className="pt-4">
          <Field>
            <FieldLabel htmlFor="rapidshyp-baseUrl">{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id="rapidshyp-baseUrl"
              autoComplete="off"
              value={baseUrl}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
