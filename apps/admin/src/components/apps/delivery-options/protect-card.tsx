'use client'

import {
  DEFAULT_PROTECT_BPS,
  INSURANCE_GST_BPS,
  PROTECT_CATEGORIES,
  type ProtectCard as ProtectCardValue,
  protectFeePaise,
} from '@commerce/core/delhivery-protect'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MoneyInput from '@/components/fields/money-input'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { bpsToPercent, percentToBps, protectCardOf, protectDraftOf } from './protect-draft'
import ProtectTypeOverrides from './protect-type-overrides'

type ProtectCardProps = {
  /** What is saved; undefined or empty uses Delhivery's rates. */
  card: ProtectCardValue | null | undefined
  onChanged: () => void
}

/** The worked example under the rates: ₹10,000 of Health and Wellness. */
const EXAMPLE_VALUE_PAISE = 1_000_000

/**
 * Delhivery Protect (Routes page): the rate per Delhivery category, Delhivery's own shown as the
 * placeholder, and the product types sent to a category by hand. Saved as one card.
 */
export default function ProtectCard({ card, onChanged }: ProtectCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()
  const [draft, setDraft] = useState(() => protectDraftOf(card))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(protectDraftOf(card))
  }, [card])

  // Event handlers
  const handleSave = async () => {
    const next = protectCardOf(draft)
    if (!next) return
    setBusy(true)
    try {
      // The courier cover terms are their own card's; kept as saved.
      await api.deliveryOptions.saveProtect({ ...next, couriers: card?.couriers ?? {} })
      toast.success(copy.saved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const p = copy.protect
  const ready = protectCardOf(draft) !== null
  const healthBps = percentToBps(draft.rates.health) ?? DEFAULT_PROTECT_BPS.health
  const fee = protectFeePaise(EXAMPLE_VALUE_PAISE, healthBps)
  const example = p.example(
    fmt.money(EXAMPLE_VALUE_PAISE),
    p.categories.health,
    `${bpsToPercent(healthBps)}%`,
    fmt.money(fee),
    fmt.money(Math.round((fee * INSURANCE_GST_BPS) / 10_000)),
  )

  return (
    <SettingsCard
      title={p.title}
      description={p.description}
      footer={
        <Button onClick={() => void handleSave()} disabled={busy || !ready} loading={busy}>
          <Save aria-hidden="true" />
          {copy.save}
        </Button>
      }
    >
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-ink-strong">{p.ratesTitle}</p>
        <p className="text-caption text-muted-foreground">{p.ratesHelp}</p>
      </div>
      <ul className="grid gap-x-6 gap-y-2 md:grid-cols-2">
        {PROTECT_CATEGORIES.map((c) => {
          const bad = percentToBps(draft.rates[c]) === undefined
          return (
            <li key={c} className="flex items-center justify-between gap-3 text-body">
              <span className="min-w-0 text-ink-strong">{p.categories[c]}</span>
              <MoneyInput
                className="w-28 shrink-0"
                aria-label={p.rateLabel(p.categories[c])}
                value={draft.rates[c]}
                placeholder={bpsToPercent(DEFAULT_PROTECT_BPS[c])}
                onChange={(v) => setDraft((d) => ({ ...d, rates: { ...d.rates, [c]: v } }))}
                currency={false}
                suffix="%"
                invalid={bad}
              />
            </li>
          )
        })}
      </ul>
      {ready ? (
        <p className="text-caption text-muted-foreground">{example}</p>
      ) : (
        <p className="text-caption text-danger">{p.rateBad}</p>
      )}
      <ProtectTypeOverrides
        overrides={draft.overrides}
        onChange={(overrides) => setDraft((d) => ({ ...d, overrides }))}
      />
    </SettingsCard>
  )
}
