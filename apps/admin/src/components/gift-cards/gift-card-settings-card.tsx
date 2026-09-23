'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { toast } from 'sonner'
import { giftCardSettingsContent as copy, GIFT_CARD_EXPIRY_MONTHS } from '@/data/gift-cards'
import { api } from '@/lib/api-client'

type GiftCardSettingsCardProps = {
  initial: { expiryMonths: number | null }
}

const NEVER = 'never'

/** Store-wide expiry for gift cards sold on the storefront. Saves on change. */
export default function GiftCardSettingsCard({ initial }: GiftCardSettingsCardProps) {
  // Hooks
  const [value, setValue] = useState(initial.expiryMonths ? String(initial.expiryMonths) : NEVER)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleChange = async (next: string) => {
    const previous = value
    setValue(next)
    setBusy(true)
    try {
      await api.giftCards.saveSettings({ expiryMonths: next === NEVER ? null : Number(next) })
      toast.success(copy.saved)
    } catch {
      setValue(previous)
      toast.error(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const items: Record<string, string> = {
    [NEVER]: copy.never,
    ...Object.fromEntries(GIFT_CARD_EXPIRY_MONTHS.map((m) => [String(m), copy.months(m)])),
  }

  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-col gap-1">
        <p className="text-card-title text-foreground">{copy.heading}</p>
        <p className="text-caption text-muted-foreground">{copy.help}</p>
      </div>
      <Field>
        <FieldLabel htmlFor="gift-card-expiry">{copy.label}</FieldLabel>
        <Select
          items={items}
          value={value}
          onValueChange={(v) => handleChange(String(v))}
          disabled={busy}
        >
          <SelectTrigger id="gift-card-expiry" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(items).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </Card>
  )
}
