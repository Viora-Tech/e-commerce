'use client'

import {
  DEFAULT_COURIER_COVER,
  INSURED_COURIERS,
  type ProtectCard,
} from '@commerce/core/delhivery-protect'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import MoneyInput from '@/components/fields/money-input'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type CoverDraftRow, coverDraftOf, coversOf, defaultRupees } from './cover-draft'
import { protectCardOf, protectDraftOf } from './protect-draft'

type InsuranceCoverCardProps = {
  /** The saved card; its rates and overrides are kept as they are. */
  card: ProtectCard | null | undefined
  onChanged: () => void
}

/** What each insuring courier pays out (Routes page): cover cap, uninsured limit, claim excess,
 *  fragile and used goods. Empty fields keep the courier's own terms, shown as placeholders. */
export default function InsuranceCoverCard({ card, onChanged }: InsuranceCoverCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const [draft, setDraft] = useState(() => coverDraftOf(card))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setDraft(coverDraftOf(card))
  }, [card])

  // Helpers
  const patch = (id: (typeof INSURED_COURIERS)[number], next: Partial<CoverDraftRow>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...next } }))
  const choices = (known: boolean | null) => {
    const c = copy.cover
    return [
      { value: 'default', label: c.asDefault(known === null ? c.unknown : known ? c.yes : c.no) },
      { value: 'yes', label: c.yes },
      { value: 'no', label: c.no },
    ]
  }

  // Event handlers
  const handleSave = async () => {
    const couriers = coversOf(draft)
    const base = protectCardOf(protectDraftOf(card))
    if (!couriers || !base) return
    setBusy(true)
    try {
      await api.deliveryOptions.saveProtect({ ...base, couriers })
      toast.success(copy.saved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const v = copy.cover
  const ready = coversOf(draft) !== null

  return (
    <SettingsCard
      title={v.title}
      description={v.description}
      footer={
        <Button onClick={() => void handleSave()} disabled={busy || !ready} loading={busy}>
          <Save aria-hidden="true" />
          {copy.save}
        </Button>
      }
    >
      <ul className="flex flex-col gap-4">
        {INSURED_COURIERS.map((id) => {
          const d = draft[id]
          const base = DEFAULT_COURIER_COVER[id]
          return (
            <li
              key={id}
              className="flex flex-col gap-2 border-t border-hairline pt-3 first:border-0 first:pt-0"
            >
              <p className="text-body font-medium text-ink-strong">{v.couriers[id]}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <MoneyInput
                  aria-label={v.cap}
                  placeholder={
                    base.coverCapPaise === null ? v.cap : defaultRupees(base.coverCapPaise)
                  }
                  value={d.cap}
                  onChange={(cap) => patch(id, { cap })}
                />
                <MoneyInput
                  aria-label={v.limit}
                  placeholder={
                    base.uninsuredLimitPaise === null
                      ? v.limit
                      : defaultRupees(base.uninsuredLimitPaise)
                  }
                  value={d.limit}
                  onChange={(limit) => patch(id, { limit })}
                />
                <MoneyInput
                  aria-label={v.excess}
                  placeholder={
                    base.deductibleBps === null ? v.excess : String(base.deductibleBps / 100)
                  }
                  value={d.excess}
                  onChange={(excess) => patch(id, { excess })}
                  currency={false}
                  suffix="%"
                />
                <ChoiceField
                  id={`cover-fragile-${id}`}
                  label={v.fragile}
                  value={d.fragile}
                  options={choices(base.coversFragile)}
                  onChange={(x) => patch(id, { fragile: x as CoverDraftRow['fragile'] })}
                />
                <ChoiceField
                  id={`cover-used-${id}`}
                  label={v.used}
                  value={d.used}
                  options={choices(base.excludesUsed)}
                  onChange={(x) => patch(id, { used: x as CoverDraftRow['used'] })}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {ready ? null : <p className="text-caption text-danger">{v.bad}</p>}
    </SettingsCard>
  )
}
