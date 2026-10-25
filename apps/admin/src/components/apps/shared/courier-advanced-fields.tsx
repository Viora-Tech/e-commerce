'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CourierAdvancedFields, CourierAdvancedCopy
 * WHAT:  the collapsed "Advanced" block of a courier's Connect page: the base URL override and,
 *        for couriers that push tracking, the webhook secret plus this store's webhook address.
 * WHY:   the same two rarely-touched fields on every newer courier (Xpressbees, Ekart, Shadowfax);
 *        the older couriers keep their own copies until they next change.
 * WHERE: the `extras` slot of ProviderConnectPage in components/apps/{xpressbees,ekart,shadowfax}.
 */

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'

export type CourierAdvancedCopy = {
  trigger: string
  baseUrlLabel: string
  baseUrlHelp: string
  webhookSecretLabel: string
  webhookSecretHelp: string
  webhookUrlLabel: string
  webhookNeedsDomain: string
}

type CourierAdvancedFieldsProps = {
  providerId: string
  copy: CourierAdvancedCopy
  baseUrl: string
  webhookSecret: string
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

export default function CourierAdvancedFields({
  providerId,
  copy,
  baseUrl,
  webhookSecret,
  onField,
  open,
  onOpenChange,
}: CourierAdvancedFieldsProps) {
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
            <FieldLabel htmlFor={`${providerId}-baseUrl`}>{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id={`${providerId}-baseUrl`}
              autoComplete="off"
              value={baseUrl}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${providerId}-webhookSecret`}>
              {copy.webhookSecretLabel}
            </FieldLabel>
            <Input
              size="lg"
              id={`${providerId}-webhookSecret`}
              type="password"
              autoComplete="off"
              value={webhookSecret}
              onChange={(e) => onField('webhookSecret', e.target.value)}
            />
            <FieldDescription>{copy.webhookSecretHelp}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-body font-medium text-foreground">{copy.webhookUrlLabel}</span>
            <p className="text-caption text-muted-foreground">
              {copy.webhookNeedsDomain}
              <br />
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
                {`${WORKER_URL}/webhooks/shipments/${providerId}/<store id>`}
              </code>
            </p>
          </div>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
