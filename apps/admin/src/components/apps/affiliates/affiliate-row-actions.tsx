'use client'

import { CircleCheck, Eye, Pause, Unlink } from '@commerce/ui/icons'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type AffiliateRowActionsProps = {
  id: string
  status: string
  onChanged: () => void
  /** Hides "Open" on the affiliate's own page. */
  showOpen?: boolean
}

/** Approve, reject or pause one affiliate; the row's own click is stopped here. */
export default function AffiliateRowActions({
  id,
  status,
  onChanged,
  showOpen = true,
}: AffiliateRowActionsProps) {
  // Hooks
  const { list: copy, failed } = useCopy(affiliatesContent)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  // Helpers
  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Event handlers
  const handleApprove = () => run(() => api.affiliates.approve({ id }), copy.approved)
  const handleReject = async () => {
    await run(() => api.affiliates.setStatus({ id, status: 'rejected', reason }), copy.rejected)
    setRejecting(false)
    setReason('')
  }
  const handleSuspend = () =>
    run(() => api.affiliates.setStatus({ id, status: 'suspended' }), copy.suspended)

  // Render logic
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only stops the row's own click; the controls inside are buttons.
    // biome-ignore lint/a11y/useKeyWithClickEvents: same, keyboard events stop at the trigger.
    <span className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
      <ActionMenu
        label={copy.menu}
        contentClassName="w-52"
        items={[
          {
            label: copy.open,
            icon: Eye,
            hidden: !showOpen,
            href: routes.apps.page('affiliates', 'affiliates', id),
          },
          {
            label: copy.approve,
            icon: CircleCheck,
            hidden: status === 'approved',
            onSelect: handleApprove,
          },
          {
            label: copy.reject,
            icon: Unlink,
            hidden: status !== 'pending',
            onSelect: () => setRejecting(true),
          },
          {
            label: copy.suspend,
            icon: Pause,
            hidden: status !== 'approved',
            destructive: true,
            onSelect: handleSuspend,
          },
        ]}
      />
      <ConfirmDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={copy.rejectTitle}
        body={copy.rejectBody}
        confirmLabel={copy.reject}
        tone="destructive"
        onConfirm={handleReject}
      >
        <Textarea
          aria-label={copy.rejectReason}
          placeholder={copy.rejectReason}
          value={reason}
          maxLength={500}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmDialog>
    </span>
  )
}
