'use client'

import { computeCommission, levelFor } from '@commerce/plugin-affiliates/commission'
import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'

type CommissionPreviewProps = { rules: ProgramRules }

const PREVIEW_PRODUCT = '00000000-0000-4000-8000-000000000000'

/**
 * What an affiliate earns on an order of a given value under these rules: the level is read on
 * the value with GST, the commission is on the sale without it. Same maths as the engine.
 */
export default function CommissionPreview({ rules }: CommissionPreviewProps) {
  // Hooks
  const { program: copy } = useCopy(affiliatesContent)
  const f = useFormat()
  const [rupees, setRupees] = useState(2000)

  // Render logic
  const value = Math.max(0, Math.round(rupees * 100))
  const result = computeCommission(
    {
      subtotalPaise: value,
      discountPaise: 0,
      lines: [
        {
          productId: PREVIEW_PRODUCT,
          collectionIds: [],
          quantity: 1,
          unitPricePaise: value,
          gstRatePercent: 18,
          giftCard: false,
        },
      ],
    },
    { ...rules, overrides: [], excludes: [] },
  )
  const level = levelFor(rules.levels, value)

  return (
    <SettingsCard title={copy.preview} description={copy.previewHelp}>
      <SettingsRow label={copy.previewOrder} htmlFor="aff-preview">
        <Input
          id="aff-preview"
          type="number"
          inputMode="decimal"
          min={0}
          className="max-w-40"
          value={rupees}
          onChange={(e) => setRupees(Number(e.target.value) || 0)}
        />
      </SettingsRow>
      <div className="flex flex-col gap-1 text-body">
        <p>{copy.previewResult(f.money(result.commissionPaise), f.money(result.basePaise))}</p>
        <p className="text-caption text-muted-foreground">
          {level ? copy.previewLevel(f.money(level.minOrderPaise)) : copy.previewNoLevel}
        </p>
      </div>
    </SettingsCard>
  )
}
