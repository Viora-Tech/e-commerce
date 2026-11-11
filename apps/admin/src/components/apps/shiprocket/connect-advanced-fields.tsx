'use client'

import { courierWebhookPath } from '@commerce/core/courier-webhook-path'
import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { shiprocketAppContent as appCopy } from '@/data/shiprocket'

type ConnectAdvancedFieldsProps = {
  baseUrl: string
  webhookSecret: string
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = appCopy.connect.advanced

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

function webhookHint() {
  return (
    <p className="text-caption text-muted-foreground">
      {copy.webhookNeedsDomain}
      <br />
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
        {`${WORKER_URL}${courierWebhookPath('shiprocket', '<store id>')}`}
      </code>
    </p>
  )
}

/** The rarely-touched fields: the manual base URL override and the webhook shared secret + URL.
 *  Collapsed by default so the guided fields above stay the whole story for a merchant who only
 *  needs the basics. */
export default function ConnectAdvancedFields({
  baseUrl,
  webhookSecret,
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
            <FieldLabel htmlFor="shiprocket-baseUrl">{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id="shiprocket-baseUrl"
              autoComplete="off"
              value={baseUrl}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="shiprocket-webhookSecret">{copy.webhookSecretLabel}</FieldLabel>
            <Input
              size="lg"
              id="shiprocket-webhookSecret"
              type="password"
              autoComplete="off"
              value={webhookSecret}
              onChange={(e) => onField('webhookSecret', e.target.value)}
            />
            <FieldDescription>{copy.webhookSecretHelp}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-body font-medium text-foreground">{copy.webhookUrlLabel}</span>
            {webhookHint()}
          </div>
        </FieldGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}
