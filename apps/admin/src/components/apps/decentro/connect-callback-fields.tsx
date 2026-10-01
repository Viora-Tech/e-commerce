'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { FieldGroup } from '@commerce/ui/shadcn/field'
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

/** The headers box as Decentro takes it: `{ "x-webhook-token": "<secret>" }`. */
const headersJson = (secret: string) => JSON.stringify({ [copy.headerName]: secret }, null, 2)

/** What Decentro's "Callback configurations" page needs: the address and the headers block. */
export default function ConnectCallbackFields({
  webhookSecret,
  webhookUrl,
  onNewSecret,
}: ConnectCallbackFieldsProps) {
  // Render logic
  const masked = isMasked(webhookSecret)
  const headers = headersJson(masked ? `<${copy.secretHidden}>` : webhookSecret)

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
        <span className="text-body font-medium text-foreground">{copy.headersLabel}</span>
        <div className="group/row flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted p-3 font-mono text-caption text-foreground">
            {headers}
          </pre>
          {masked ? null : <CopyButton value={headers} what={copy.headersLabel} />}
        </div>
        <p className="text-caption text-muted-foreground">
          {copy.headersHelp} {masked ? copy.secretSaved : copy.secretCopyNow}
        </p>
        <Button type="button" variant="outline" className="w-fit" onClick={onNewSecret}>
          {copy.newSecret}
        </Button>
      </div>
    </FieldGroup>
  )
}
