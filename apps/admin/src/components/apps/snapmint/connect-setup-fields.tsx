'use client'

import { FieldGroup } from '@commerce/ui/shadcn/field'
import CopyButton from '@/components/fields/copy-button'
import { snapmintAppContent } from '@/data/snapmint'
import { useCopy } from '@/hooks/use-copy'

type ConnectSetupFieldsProps = {
  webhookUrl: string
}

/** What Snapmint sets up on its side: our payment updates URL, and our server IPs on its allow list. */
export default function ConnectSetupFields({ webhookUrl }: ConnectSetupFieldsProps) {
  // Hooks
  const { setup: copy } = useCopy(snapmintAppContent).connect

  return (
    <FieldGroup>
      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.heading}</span>
        <p className="text-caption text-muted-foreground">{copy.intro}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.webhookLabel}</span>
        <div className="group/row flex items-center gap-2">
          <code className="break-all rounded bg-muted px-1 py-0.5 font-mono text-caption text-foreground">
            {webhookUrl}
          </code>
          <CopyButton value={webhookUrl} what={copy.webhookLabel} />
        </div>
        <p className="text-caption text-muted-foreground">{copy.webhookHelp}</p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-body font-medium text-foreground">{copy.ipLabel}</span>
        <p className="text-caption text-muted-foreground">{copy.ipHelp}</p>
      </div>
    </FieldGroup>
  )
}
