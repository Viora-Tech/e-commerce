'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { dtdcAppContent } from '@/data/dtdc'
import { useCopy } from '@/hooks/use-copy'

type ConnectAdvancedFieldsProps = {
  values: FieldValues
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The rarely-touched fields: the base URL override and DTDC's service type. Collapsed so the
 *  guided fields above stay the whole story for a merchant who only needs the basics. */
export default function ConnectAdvancedFields({
  values,
  onField,
  open,
  onOpenChange,
}: ConnectAdvancedFieldsProps) {
  // Hooks
  const { connect } = useCopy(dtdcAppContent)

  // Render logic
  const copy = connect.advanced

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
            <FieldLabel htmlFor="dtdc-serviceType">{copy.serviceTypeLabel}</FieldLabel>
            <Input
              size="lg"
              id="dtdc-serviceType"
              autoComplete="off"
              value={values.serviceType ?? ''}
              onChange={(e) => onField('serviceType', e.target.value)}
            />
            <FieldDescription>{copy.serviceTypeHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="dtdc-baseUrl">{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id="dtdc-baseUrl"
              autoComplete="off"
              value={values.baseUrl ?? ''}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
