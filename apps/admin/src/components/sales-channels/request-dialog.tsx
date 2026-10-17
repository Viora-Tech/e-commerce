'use client'

import type { SalesChannelId } from '@commerce/core/sales-channels'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RequestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: SalesChannelId
  name: string
  requestedAt: string | null
  onWithdrawn: () => void
}

/** "View request": when access was asked for, and a way to withdraw it. */
export default function RequestDialog({
  open,
  onOpenChange,
  channel,
  name,
  requestedAt,
  onWithdrawn,
}: RequestDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.bar)
  const failed = useCopy(salesChannelsContent.connect.failed)
  const format = useFormat()

  // Event handlers
  const handleWithdraw = async () => {
    try {
      await api.salesChannels.cancel({ channel })
      onWithdrawn()
      onOpenChange(false)
    } catch (err) {
      toast.error(failed)
      throw err
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.requested(name)}
      description={copy.requestedBody(requestedAt ? format.date(requestedAt) : '')}
      submitLabel={copy.withdraw}
      onSubmit={handleWithdraw}
    >
      {null}
    </FormDialog>
  )
}
