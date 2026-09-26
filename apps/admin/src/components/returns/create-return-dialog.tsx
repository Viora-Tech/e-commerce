'use client'

import { RETURN_REASONS, type ReturnReason } from '@commerce/core/returns'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import { orderReturnsContent, returnDetailContent, returnsContent } from '@/data/returns'
import { api } from '@/lib/api-client'

type State = NonNullable<Awaited<ReturnType<typeof api.returns.forOrder>>>

type CreateReturnDialogProps = {
  orderId: string
  state: State
  open: boolean
  onClose: () => void
  onDone: () => void
}

const copy = orderReturnsContent.dialog
const reasonItems = Object.fromEntries(RETURN_REASONS.map((r) => [r, returnsContent.reasons[r]]))

const isReason = (v: unknown): v is ReturnReason =>
  typeof v === 'string' && (RETURN_REASONS as readonly string[]).includes(v)

/** Open a return on the customer's behalf: how many of each item, and why. */
export default function CreateReturnDialog({
  orderId,
  state,
  open,
  onClose,
  onDone,
}: CreateReturnDialogProps) {
  // Hooks
  const [qty, setQty] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<ReturnReason>('damaged')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleQty = (lineId: string, raw: string, max: number) => {
    const n = Math.max(0, Math.min(max, Math.round(Number(raw) || 0)))
    setQty((q) => ({ ...q, [lineId]: n }))
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      await api.returns.create({
        orderId,
        lines: picked.map(([orderLineId, quantity]) => ({ orderLineId, quantity })),
        reason,
        note: note.trim() || undefined,
      })
      toast.success(copy.done)
      setQty({})
      setNote('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const returnable = new Map(state.eligibility.lines.map((l) => [l.lineId, l.returnable]))
  const lines = state.lines.filter((l) => (returnable.get(l.id) ?? 0) > 0)
  const picked = Object.entries(qty).filter(([, n]) => n > 0)

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {lines.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.nothing}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {lines.map((l) => {
                const max = returnable.get(l.id) ?? 0
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="line-clamp-1 text-body">{l.title}</span>
                      <span className="text-caption text-muted-foreground">{copy.left(max)}</span>
                    </span>
                    <Input
                      aria-label={l.title}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max={max}
                      className="w-20"
                      value={qty[l.id] ?? 0}
                      onChange={(e) => handleQty(l.id, e.target.value, max)}
                    />
                  </li>
                )
              })}
            </ul>
            <Field>
              <FieldLabel htmlFor="create-return-reason">{copy.reason}</FieldLabel>
              <Select
                items={reasonItems}
                value={reason}
                onValueChange={(v) => (isReason(v) ? setReason(v) : undefined)}
              >
                <SelectTrigger id="create-return-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {returnsContent.reasons[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="create-return-note">{copy.note}</FieldLabel>
              <Textarea
                id="create-return-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {returnDetailContent.cancel}
          </Button>
          <Button type="button" onClick={handleCreate} disabled={busy || picked.length === 0}>
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
