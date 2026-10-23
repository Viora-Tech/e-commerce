'use client'

import { parseRupees } from '@commerce/money'
import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import { GIFT_CARD_PRODUCT_DEFAULTS, giftCardProductsContent } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type GiftCardProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

const copy = giftCardProductsContent.dialog
const DEFAULT_PAISE = GIFT_CARD_PRODUCT_DEFAULTS.map((r) => r * 100)

/** Rupees typed in the field to whole paise; null when it is not a positive amount. */
function positivePaise(text: string): number | null {
  const paise = parseRupees(text)
  return paise && paise > 0 ? paise : null
}

/** Title and denominations for a new gift card product; opens the product once created. */
export default function GiftCardProductDialog({
  open,
  onOpenChange,
  onCreated,
}: GiftCardProductDialogProps) {
  // Hooks
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [values, setValues] = useState<number[]>(DEFAULT_PAISE)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(copy.defaultName)
    setValues(DEFAULT_PAISE)
    setDraft('')
  }, [open])

  // Event handlers
  const handleAdd = () => {
    const paise = positivePaise(draft)
    if (!paise) return
    setValues((prev) => [...new Set([...prev, paise])].sort((a, b) => a - b))
    setDraft('')
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleAdd()
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const { id } = await api.giftCards.createProduct({
        title: title.trim(),
        denominationsPaise: values,
      })
      toast.success(copy.created)
      onCreated()
      onOpenChange(false)
      router.push(`/products/${id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="gc-product-title">{copy.name}</FieldLabel>
            <Input
              id="gc-product-title"
              size="lg"
              value={title}
              placeholder={copy.namePlaceholder}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="gc-product-value">{copy.denominations}</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {values.map((v) => (
                <span
                  key={v}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-body tabular-nums"
                >
                  {formatPaise(v)}
                  <button
                    type="button"
                    aria-label={copy.remove(formatPaise(v))}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setValues((prev) => prev.filter((x) => x !== v))}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={handleAddSubmit}>
              <MoneyInput id="gc-product-value" value={draft} onChange={setDraft} />
              <Button type="submit" variant="outline" disabled={!positivePaise(draft)}>
                {copy.add}
              </Button>
            </form>
            <FieldDescription>{copy.denominationsHelp}</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={busy || !title.trim() || values.length === 0}>
            <Plus aria-hidden="true" />
            {busy ? copy.creating : copy.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
