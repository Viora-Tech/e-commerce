'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
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
    // The neutral banner as a strip across the top of the thread.
    <Alert
      tone="neutral"
      role="status"
      className="rounded-none border-x-0 border-t-0"
      action={
        canTakeOver ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={handleTakeOver}>
            {t.action}
          </Button>
        ) : null
      }
    >
      <AiIcon aria-hidden="true" />
      <AlertTitle className="text-body-strong">{t.title}</AlertTitle>
      <AlertDescription className="text-caption">{t.hint}</AlertDescription>
    </Alert>
  )
}
