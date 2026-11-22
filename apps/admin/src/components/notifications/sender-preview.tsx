import { senderEmailContent } from '@/data/sender-email'
import { useCopy } from '@/hooks/use-copy'
import type { SenderEmailOverview } from './types'

type SenderPreviewProps = {
  preview: SenderEmailOverview['preview']
  /** The platform account is not sending (development). */
  devOnly: boolean
}

/** What a customer's inbox shows right now: the From line and where replies go. */
export default function SenderPreview({ preview, devOnly }: SenderPreviewProps) {
  // Hooks
  const copy = useCopy(senderEmailContent.now)

  // Render logic
  const note = preview.using === 'own' ? copy.ownNote : copy.platformNote

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/60 p-3">
      <p className="text-caption font-medium text-muted-foreground">{copy.label}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body">
        <dt className="text-muted-foreground">{copy.from}</dt>
        <dd className="font-mono break-all text-foreground">{preview.from}</dd>
        {preview.replyTo ? (
          <>
            <dt className="text-muted-foreground">{copy.replyTo}</dt>
            <dd className="font-mono break-all text-foreground">{preview.replyTo}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-caption text-muted-foreground">{note}</p>
      {devOnly ? <p className="text-caption text-muted-foreground">{copy.devNote}</p> : null}
    </div>
  )
}
