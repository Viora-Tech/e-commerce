'use client'

import { Pencil, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { giftCardDetailContent } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type BalanceCardProps = {
  card: {
    id: string
    balancePaise: number
    initialValuePaise: number
    /** A disabled card can't be spent, so its balance isn't adjusted either (audit #155). */
    disabledAt: Date | string | null
  }
  onChanged: () => Promise<void>
}

const copy = giftCardDetailContent

/** Big balance figure with the adjust dialog (add or remove money, with a reason). */
export default function BalanceCard({ card, onChanged }: BalanceCardProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpen = () => {
    setDirection('add')
    setAmount('')
    setNote('')
    setOpen(true)
  }

  const handleSave = async (deltaPaise: number) => {
    setBusy(true)
    try {
      await api.giftCards.adjust({ id: card.id, amountPaise: deltaPaise, note: note.trim() })
      toast.success(copy.adjust.saved)
      setOpen(false)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.adjust.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const paise = Math.round(Number(amount) * 100)
  const valid = Number.isFinite(paise) && paise > 0
  const delta = direction === 'add' ? paise : -paise
  const next = card.balancePaise + (valid ? delta : 0)
  const canSave = !busy && valid && note.trim().length > 0 && next >= 0

  return (
    <DataCard
      title={copy.balance.heading}
      action={
        card.disabledAt ? undefined : (
          <Button variant="outline" size="sm" onClick={handleOpen}>
            <Pencil aria-hidden="true" />
            {copy.balance.adjust}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-stat text-ink-strong tabular-nums">{formatPaise(card.balancePaise)}</p>
        <p className="text-caption text-muted-foreground">
          {copy.balance.of(formatPaise(card.initialValuePaise))}
        </p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.adjust.title}</DialogTitle>
            <DialogDescription>{copy.adjust.body}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <ToggleGroup
              value={[direction]}
              onValueChange={(v) => v[0] && setDirection(v[0] as 'add' | 'remove')}
              variant="outline"
            >
              <ToggleGroupItem value="add">{copy.adjust.add}</ToggleGroupItem>
              <ToggleGroupItem value="remove">{copy.adjust.remove}</ToggleGroupItem>
            </ToggleGroup>
            <Field>
              <FieldLabel htmlFor="gc-adjust-amount">{copy.adjust.amount}</FieldLabel>
              <MoneyInput id="gc-adjust-amount" value={amount} onChange={setAmount} />
              <p className="text-caption text-muted-foreground tabular-nums">
                {copy.adjust.newBalance(formatPaise(Math.max(0, next)))}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="gc-adjust-note">{copy.adjust.note}</FieldLabel>
              <Input
                id="gc-adjust-note"
                value={note}
                maxLength={500}
                placeholder={copy.adjust.notePlaceholder}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              {copy.adjust.cancel}
            </Button>
            <Button onClick={() => handleSave(delta)} disabled={!canSave}>
              <Save aria-hidden="true" />
              {busy ? copy.adjust.saving : copy.adjust.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataCard>
  )
}
