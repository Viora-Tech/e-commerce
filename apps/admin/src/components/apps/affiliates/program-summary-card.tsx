'use client'

import { couponOffer, type ProgramRules } from '@commerce/plugin-affiliates/settings'
import { rateText } from '@/components/apps/affiliates/rule-label'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy, useFormat } from '@/hooks/use-copy'

type ProgramSummaryCardProps = {
  name: string
  isDefault: boolean
  archived: boolean
  rules: ProgramRules
}

/** Program editor › Summary (UpPromote's side card): the name, its chip and the commission structure. */
export default function ProgramSummaryCard({
  name,
  isDefault,
  archived,
  rules,
}: ProgramSummaryCardProps) {
  // Hooks
  const { editor: copy } = useCopy(affiliatesLayoutContent)
  const { programs } = useCopy(affiliatesContent)
  const f = useFormat()

  // Render logic
  const b = copy.bullets
  const offer = couponOffer(rules.coupon)
  const lines = [
    b.rate(rateText(rules.commission, f.money)),
    rules.levels.length > 0 ? b.levels(rules.levels.length) : null,
    rules.overrides.length > 0 ? b.products(rules.overrides.length) : null,
    rules.tiers.length > 0 ? b.tiers(rules.tiers.length) : null,
    rules.scope === 'lifetime' ? b.lifetime(rules.lifetimeDays) : b.firstOrder,
    offer ? (offer.selected ? b.couponSelected : b.coupon)(offer.percent) : b.noCoupon,
    rules.excludes.length > 0 ? b.excluded(rules.excludes.length) : null,
    b.fees,
    b.self,
  ].filter((l): l is string => l !== null)

  return (
    <DataCard title={copy.summary}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body font-medium">{name || '—'}</span>
          {archived ? (
            <StatusChip tone="neutral">{programs.archived}</StatusChip>
          ) : (
            <StatusChip tone="success">{copy.active}</StatusChip>
          )}
          {isDefault ? <StatusChip tone="info">{programs.isDefault}</StatusChip> : null}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-body font-medium">{copy.structure}</p>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-muted-foreground">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </DataCard>
  )
}
