'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import CopyButton from '@/components/fields/copy-button'
import { decentroAppContent as appCopy } from '@/data/decentro'

type ConnectAdvancedFieldsProps = {
  flow: string
  webhookSecret: string
  payoutConsumerUrn: string
  webhookUrl: string
  onField: (key: string, value: string) => void
  onNewSecret: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = appCopy.connect.advanced

const FLOWS = ['qr', 'link'] as const

/** Saved secrets come back masked (`••••1234`): nothing left to copy. */
const isMasked = (v: string) => v.startsWith('••••')

/** Rarely-touched settings: checkout style, the callback secret and address, payouts. */
export default function ConnectAdvancedFields({
  flow,
  webhookSecret,
  payoutConsumerUrn,
  webhookUrl,
  onField,
  onNewSecret,
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
            <FieldLabel>{copy.flowLabel}</FieldLabel>
            <RadioGroup value={flow} onValueChange={(v) => onField('flow', String(v))}>
              {FLOWS.map((f) => (
                <Field key={f} orientation="horizontal">
                  <RadioGroupItem id={`decentro-flow-${f}`} value={f} />
                  <FieldLabel htmlFor={`decentro-flow-${f}`} className="font-normal">
                    {copy.flows[f]}
                  </FieldLabel>
                </Field>
              ))}
            </RadioGroup>
            <FieldDescription>{copy.flowHelp}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="decentro-webhookSecret">{copy.webhookSecretLabel}</FieldLabel>
            <div className="group/row flex items-center gap-2">
              <Input
                size="lg"
                id="decentro-webhookSecret"
                autoComplete="off"
                readOnly
                value={webhookSecret}
                className="font-mono"
              />
              {isMasked(webhookSecret) ? null : (
                <CopyButton value={webhookSecret} what={copy.webhookSecretLabel} />
              )}
            </div>
            <FieldDescription>
              {copy.webhookSecretHelp}{' '}
              {isMasked(webhookSecret) ? copy.webhookSecretSaved : copy.webhookSecretCopyNow}
            </FieldDescription>
            <Button type="button" variant="outline" className="w-fit" onClick={onNewSecret}>
              {copy.newSecret}
            </Button>
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-body font-medium text-foreground">{copy.webhookUrlLabel}</span>
            <div className="group/row flex items-center gap-2">
              <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-caption text-foreground">
                {webhookUrl}
              </code>
              <CopyButton value={webhookUrl} what={copy.webhookUrlLabel} />
            </div>
            <p className="text-caption text-muted-foreground">{copy.webhookUrlHelp}</p>
          </div>

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
