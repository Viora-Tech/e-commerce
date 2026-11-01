'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { useCopy } from '@/hooks/use-copy'

type AiActiveBannerProps = {
  /** Staff may reply here, so they may take over too. */
  canTakeOver: boolean
  onTakeOver: () => Promise<void>
}

/** Above the thread while the AI agent still answers it: says so, with Take over on the right. */
export default function AiActiveBanner({ canTakeOver, onTakeOver }: AiActiveBannerProps) {
  // Hooks
  const copy = useCopy(inboxKnowledgeContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleTakeOver = async () => {
    setBusy(true)
    try {
      await onTakeOver()
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const t = copy.takeOver

  return (
    <div className="flex items-start gap-2.5 border-b border-hairline bg-muted/50 px-4 py-3">
      <AiIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-strong">{t.title}</p>
        <p className="text-caption text-muted-foreground">{t.hint}</p>
      </div>
      {canTakeOver ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={handleTakeOver}>
          {t.action}
        </Button>
      ) : null}
    </div>
  )
}
