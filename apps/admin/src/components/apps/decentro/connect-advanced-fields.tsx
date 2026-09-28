'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { decentroAppContent as appCopy } from '@/data/decentro'

type ConnectAdvancedFieldsProps = {
  payoutConsumerUrn: string
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = appCopy.connect.advanced

/** Rarely-touched settings: the separate payouts code. */
export default function ConnectAdvancedFields({
  payoutConsumerUrn,
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
            <FieldLabel htmlFor="decentro-payoutConsumerUrn">{copy.payoutUrnLabel}</FieldLabel>
            <Input
              size="lg"
              id="decentro-payoutConsumerUrn"
              autoComplete="off"
              value={payoutConsumerUrn}
              onChange={(e) => onField('payoutConsumerUrn', e.target.value)}
            />
            <FieldDescription>{copy.payoutUrnHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
