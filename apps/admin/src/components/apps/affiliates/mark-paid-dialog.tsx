'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type MarkPaidDialogProps = {
  payoutId: string | null
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}

/** Records the UTR of a payout the merchant made outside the platform; the affiliate is emailed. */
export default function MarkPaidDialog({ payoutId, onOpenChange, onPaid }: MarkPaidDialogProps) {
  // Hooks
  const { payouts: copy, failed } = useCopy(affiliatesContent)
  const [reference, setReference] = useState('')

  // Event handlers
  const handleConfirm = async () => {
    if (!payoutId) return
    try {
      await api.affiliates.payouts.markPaid({ id: payoutId, reference })
      toast.success(copy.paid)
      setReference('')
      onPaid()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
      throw err
    }
  }

  // Render logic
  return (
    <ConfirmDialog
      open={payoutId !== null}
      onOpenChange={onOpenChange}
      title={copy.markPaidTitle}
      body={copy.markPaidBody}
      confirmLabel={copy.confirm}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="payout-ref">{copy.reference}</Label>
        <Input
          id="payout-ref"
          maxLength={120}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>
    </ConfirmDialog>
  )
}
