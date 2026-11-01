'use client'

import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import ActionCard from '@/components/assistant/action-card'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ActionView = Awaited<ReturnType<typeof api.ai.action>>

type ApprovalDialogProps = {
  /** The AI action to show; null closes the dialog. */
  actionId: string | null
  onClose: () => void
  /** After approve, edit or cancel, so the list behind can refresh. */
  onChange?: () => void
}

/**
 * "Open approval": the same card the AI bar shows (preview, Approve, Edit, Cancel) for a
 * change an AI client proposed over MCP.
 */
export default function ApprovalDialog({ actionId, onClose, onChange }: ApprovalDialogProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const [view, setView] = useState<ActionView | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!actionId) return
    setView(null)
    setFailed(false)
    api.ai
      .action({ id: actionId })
      .then(setView)
      .catch(() => setFailed(true))
  }, [actionId])

  // Event handlers
  const handleChange = (next: ActionView) => {
    setView(next)
    onChange?.()
  }

  // Render logic
  return (
    <Dialog open={actionId !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.activity.openApproval}</DialogTitle>
          <DialogDescription className="sr-only">
            {copy.permissions.rules.sensitive}
          </DialogDescription>
        </DialogHeader>
        {failed ? (
          <p className="text-body text-muted-foreground">{copy.activity.loadFailed}</p>
        ) : view ? (
          <ActionCard action={view} onChange={handleChange} />
        ) : (
          <Skeleton className="h-40 w-full rounded-xl" />
        )}
      </DialogContent>
    </Dialog>
  )
}
