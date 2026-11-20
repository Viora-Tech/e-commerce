'use client'

import { CLAIM_STATUSES, type ClaimStatus } from '@commerce/core/shipment-lost-state'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { shipmentLostContent } from '@/data/shipment-lost'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ShipmentClaimDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shipmentId: string
  waybill: string
  claimStatus: string | null
  claimAmountPaise: number | null
  claimNote: string | null
  onSaved: () => void
}

/** "12,500.50" → paise; empty or not a number → null. */
function toPaise(text: string): number | null {
  const n = Number(text.replace(/,/g, '').trim())
  return text.trim() === '' || Number.isNaN(n) || n < 0 ? null : Math.round(n * 100)
}

/**
 * The courier claim on a lost parcel: its state (not filed, filed, paid, rejected), the amount
 * (prefilled with what the courier should pay) and the claim number or a note.
 */
export default function ShipmentClaimDialog({
  open,
  onOpenChange,
  shipmentId,
  waybill,
  claimStatus,
  claimAmountPaise,
  claimNote,
  onSaved,
}: ShipmentClaimDialogProps) {
  // Hooks
  const copy = useCopy(shipmentLostContent)
  const [status, setStatus] = useState<ClaimStatus>('not_filed')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Each opening starts from the saved claim.
  useEffect(() => {
    if (!open) return
    setStatus(
      (CLAIM_STATUSES as readonly string[]).includes(claimStatus ?? '')
        ? (claimStatus as ClaimStatus)
        : 'not_filed',
    )
    setAmount(claimAmountPaise === null ? '' : String(claimAmountPaise / 100))
    setNote(claimNote ?? '')
  }, [open, claimStatus, claimAmountPaise, claimNote])

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.shipments.updateClaim({
        shipmentId,
        status,
        amountPaise: toPaise(amount),
        note: note.trim() || null,
      })
      toast.success(copy.claim.saved)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const items = Object.fromEntries(CLAIM_STATUSES.map((s) => [s, copy.claim.statuses[s] ?? s]))

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent busy={saving} onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{copy.claim.title(waybill)}</DialogTitle>
          <DialogDescription>{copy.claim.body}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`claim-status-${shipmentId}`}>{copy.claim.status}</Label>
            <Select items={items} value={status} onValueChange={(v) => setStatus(v as ClaimStatus)}>
              <SelectTrigger id={`claim-status-${shipmentId}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {items[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`claim-amount-${shipmentId}`}>{copy.claim.amount}</Label>
            <Input
              id={`claim-amount-${shipmentId}`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="text-caption text-muted-foreground">{copy.claim.amountHelp}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`claim-note-${shipmentId}`}>{copy.claim.note}</Label>
            <Textarea
              id={`claim-note-${shipmentId}`}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {copy.claim.cancel}
          </Button>
          <Button loading={saving} onClick={handleSave}>
            {copy.claim.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
