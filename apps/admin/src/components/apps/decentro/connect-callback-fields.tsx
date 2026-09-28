'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import CopyButton from '@/components/fields/copy-button'
import { decentroAppContent as appCopy } from '@/data/decentro'

type ConnectCallbackFieldsProps = {
  webhookSecret: string
  webhookUrl: string
  onNewSecret: () => void
}

const copy = appCopy.connect.callback

/** Saved secrets come back masked (`••••1234`): nothing left to copy. */
const isMasked = (v: string) => v.startsWith('••••')

/** What Decentro's "Callback configurations" page needs: the address, the header name and the secret. */
export default function ConnectCallbackFields({
  webhookSecret,
  webhookUrl,
  onNewSecret,
}: ConnectCallbackFieldsProps) {
  return (
    <FieldGroup>
      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.heading}</span>
        <p className="text-caption text-muted-foreground">{copy.intro}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.urlLabel}</span>
        <div className="group/row flex items-center gap-2">
          <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-caption text-foreground">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} what={copy.urlLabel} />
        </div>
        <p className="text-caption text-muted-foreground">{copy.urlHelp}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.headerLabel}</span>
        <div className="group/row flex items-center gap-2">
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-caption text-foreground">
            {copy.headerName}
          </code>
          <CopyButton value={copy.headerName} what={copy.headerLabel} />
        </div>
        <p className="text-caption text-muted-foreground">{copy.headerHelp}</p>
      </div>

      <Field>
        <FieldLabel htmlFor="decentro-webhookSecret">{copy.secretLabel}</FieldLabel>
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
            <CopyButton value={webhookSecret} what={copy.secretLabel} />
          )}
        </div>
        <FieldDescription>
          {copy.secretHelp} {isMasked(webhookSecret) ? copy.secretSaved : copy.secretCopyNow}
        </FieldDescription>
        <Button type="button" variant="outline" className="w-fit" onClick={onNewSecret}>
          {copy.newSecret}
        </Button>
      </Field>
    </FieldGroup>
  )
}
