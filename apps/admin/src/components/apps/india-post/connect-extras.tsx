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
import { Textarea } from '@commerce/ui/shadcn/textarea'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { indiaPostAppContent as appCopy } from '@/data/india-post'
import { useCopy } from '@/hooks/use-copy'

type ConnectExtrasProps = {
  values: FieldValues
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The business account switches (contract rates, COD and its fee), then the merchant's own
 *  rate card, collapsed: most stores ship on India Post's published tariff. */
export default function ConnectExtras({ values, onField, open, onOpenChange }: ConnectExtrasProps) {
  // Hooks
  const copy = useCopy(appCopy)

  // Render logic
  const cod = values.codEnabled === 'true'

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup>
        <Field orientation="horizontal" className="justify-between">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="india-post-contractRates" className="font-normal">
              {copy.connect.fields.contractRates.label}
            </FieldLabel>
            <FieldDescription>{copy.connect.fields.contractRates.help}</FieldDescription>
          </div>
          <Switch
            id="india-post-contractRates"
            checked={values.contractRates === 'true'}
            onCheckedChange={(v) => onField('contractRates', v ? 'true' : 'false')}
          />
        </Field>
        <Field orientation="horizontal" className="justify-between">
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="india-post-codEnabled" className="font-normal">
              {copy.connect.fields.codEnabled.label}
            </FieldLabel>
            <FieldDescription>{copy.connect.fields.codEnabled.help}</FieldDescription>
          </div>
          <Switch
            id="india-post-codEnabled"
            checked={cod}
            onCheckedChange={(v) => onField('codEnabled', v ? 'true' : 'false')}
          />
        </Field>
        {cod ? (
          <Field>
            <FieldLabel htmlFor="india-post-codFeeRupees">
              {copy.connect.fields.codFeeRupees.label}
            </FieldLabel>
            <Input
              size="lg"
              id="india-post-codFeeRupees"
              inputMode="decimal"
              autoComplete="off"
              value={values.codFeeRupees ?? ''}
              onChange={(e) => onField('codFeeRupees', e.target.value)}
            />
            <FieldDescription>{copy.connect.fields.codFeeRupees.help}</FieldDescription>
          </Field>
        ) : null}
      </FieldGroup>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {copy.connect.advanced.trigger}
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Field className="pt-4">
            <FieldLabel htmlFor="india-post-tariffOverride">
              {copy.connect.advanced.tariffLabel}
            </FieldLabel>
            <Textarea
              id="india-post-tariffOverride"
              rows={8}
              spellCheck={false}
              className="font-mono text-caption"
              value={values.tariffOverride ?? ''}
              onChange={(e) => onField('tariffOverride', e.target.value)}
            />
            <FieldDescription>{copy.connect.advanced.tariffHelp}</FieldDescription>
          </Field>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
