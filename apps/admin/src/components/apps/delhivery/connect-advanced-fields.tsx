'use client'

import { ChevronDown, InfoIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy } from '@/hooks/use-copy'

type ConnectAdvancedFieldsProps = {
  baseUrl: string
  expressMode: string
  webhookSecret: string
  onField: (key: string, value: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

/** The rarely-touched fields: the manual base URL override, Express quotes, and the webhook
 *  shared secret + URL. Collapsed by default so the guided fields above stay the whole story
 *  for a merchant who only needs the basics. */
export default function ConnectAdvancedFields({
  baseUrl,
  expressMode,
  webhookSecret,
  onField,
  open,
  onOpenChange,
}: ConnectAdvancedFieldsProps) {
  // Hooks
  const copy = useCopy(delhiveryAppContent).connect.advanced

  // Derived
  /** Figma "Advanced open": where the tracking webhook goes, and why it needs a live domain. */
  function webhookHint() {
    return (
      <div className="flex flex-col gap-2">
        <code className="w-fit rounded bg-muted px-1 py-0.5 font-mono text-caption text-foreground">
          {`${WORKER_URL}/webhooks/shipments/delhivery/<store id>`}
        </code>
        <Alert tone="info">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>{copy.webhookNeedsDomain}</AlertDescription>
        </Alert>
      </div>
    )
  }

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
            <FieldLabel htmlFor="delhivery-baseUrl">{copy.baseUrlLabel}</FieldLabel>
            <Input
              size="lg"
              id="delhivery-baseUrl"
              autoComplete="off"
              value={baseUrl}
              onChange={(e) => onField('baseUrl', e.target.value)}
            />
            <FieldDescription>{copy.baseUrlHelp}</FieldDescription>
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <div className="flex flex-col gap-1">
              <FieldLabel htmlFor="delhivery-expressMode" className="font-normal">
                {copy.expressLabel}
              </FieldLabel>
              <FieldDescription>{copy.expressHelp}</FieldDescription>
            </div>
            <Switch
              id="delhivery-expressMode"
              checked={expressMode === 'true'}
              onCheckedChange={(v) => onField('expressMode', v ? 'true' : 'false')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="delhivery-webhookSecret">{copy.webhookSecretLabel}</FieldLabel>
            <Input
              size="lg"
              id="delhivery-webhookSecret"
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
