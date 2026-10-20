'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { bluedartAppContent } from '@/data/bluedart'
import { useCopy } from '@/hooks/use-copy'

type ConnectAdvancedFieldsProps = {
  values: FieldValues
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The rarely-touched fields: base URL, Surface instead of Apex, pickup with every waybill, and
 *  the pickup address for "Schedule pickup". Collapsed so the guided fields stay the story. */
export default function ConnectAdvancedFields({
  values,
  onField,
  open,
  onOpenChange,
}: ConnectAdvancedFieldsProps) {
  // Hooks
  const { connect } = useCopy(bluedartAppContent)

  // Render logic
  const copy = connect.advanced
  const registerPickup = values.registerPickup !== 'false'

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
            <FieldLabel htmlFor="bluedart-baseUrl">{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id="bluedart-baseUrl"
              autoComplete="off"
              value={values.baseUrl ?? ''}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="bluedart-surfaceMode" className="font-normal">
                {copy.surfaceLabel}
              </FieldLabel>
              <FieldDescription>{copy.surfaceHelp}</FieldDescription>
            </div>
            <Switch
              id="bluedart-surfaceMode"
              checked={values.surfaceMode === 'true'}
              onCheckedChange={(v) => onField('surfaceMode', v ? 'true' : 'false')}
            />
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="bluedart-registerPickup" className="font-normal">
                {copy.registerPickupLabel}
              </FieldLabel>
              <FieldDescription>{copy.registerPickupHelp}</FieldDescription>
            </div>
            <Switch
              id="bluedart-registerPickup"
              checked={registerPickup}
              onCheckedChange={(v) => onField('registerPickup', v ? 'true' : 'false')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bluedart-pickupAddress">{copy.pickupAddressLabel}</FieldLabel>
            <Input
              size="lg"
              id="bluedart-pickupAddress"
              autoComplete="street-address"
              value={values.pickupAddress ?? ''}
              onChange={(e) => onField('pickupAddress', e.target.value)}
            />
            <FieldDescription>{copy.pickupAddressHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="bluedart-pickupPhone">{copy.pickupPhoneLabel}</FieldLabel>
            <Input
              size="lg"
              id="bluedart-pickupPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={values.pickupPhone ?? ''}
              onChange={(e) => onField('pickupPhone', e.target.value)}
            />
            <FieldDescription>{copy.pickupPhoneHelp}</FieldDescription>
          </Field>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
