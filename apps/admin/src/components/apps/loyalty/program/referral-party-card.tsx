'use client'

import type { LoyaltySettings, ReferralReward } from '@commerce/core/loyalty'
import { BadgePercent, Gift, ReceiptIcon } from '@commerce/ui/icons'
import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import NumberRow from '@/components/apps/cod-rto/number-row'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useFormat } from '@/hooks/use-copy'
import ListRow from './list-row'
import ListSection from './list-section'
import ReferralRewardFields from './referral-reward-fields'

type Referrals = LoyaltySettings['referrals']

type ReferralPartyCardProps = {
  /** `referrer`: the member who shares; `friend`: the new customer. */
  side: 'referrer' | 'friend'
  referrals: Referrals
  onChange: (patch: Partial<Referrals>) => void
}

type Row = 'reward' | 'tag' | 'orderTag' | 'limit' | 'codeDays'

const GLYPH = { points: Gift, percent: BadgePercent, fixed: ReceiptIcon } as const

/** "100 points", "10% off", "₹100 off". */
export function rewardText(
  r: ReferralReward,
  c: (typeof loyaltyProgramContent)['referrals'],
  money: (paise: number) => string,
): string {
  if (r.kind === 'points') return c.rewardPoints(r.value)
  return c.rewardOff(r.kind === 'percent' ? `${r.value}%` : money(r.value))
}

/**
 * "Referring member" or "Referred friend": the reward row first (raised), then the rows that
 * add a tag, a limit, the refund-window hold or the code's life. Rows expand in place.
 */
export default function ReferralPartyCard({ side, referrals, onChange }: ReferralPartyCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const fmt = useFormat()
  const [open, setOpen] = useState<Row | null>(null)

  // Helpers
  const toggle = (row: Row) => setOpen((o) => (o === row ? null : row))
  const tagRow = (
    row: 'tag' | 'orderTag',
    key: 'referrerTag' | 'friendTag' | 'orderTag',
    label: string,
  ) => (
    <ListRow
      label={label}
      value={referrals[key] || undefined}
      empty={referrals[key] === ''}
      open={open === row}
      onToggle={() => toggle(row)}
    >
      <Field>
        <Input
          id={`referral-${key}`}
          size="lg"
          maxLength={60}
          aria-label={label}
          value={referrals[key]}
          onChange={(e) => onChange({ [key]: e.target.value })}
        />
        <FieldDescription>{copy.referrals.tagHelp}</FieldDescription>
      </Field>
    </ListRow>
  )

  // Render logic
  const c = copy.referrals
  const referrer = side === 'referrer'
  const reward = referrer ? referrals.referrerReward : referrals.friendReward
  const Glyph = GLYPH[reward.kind]

  return (
    <ListSection
      title={referrer ? c.referrer : c.friend}
      subtitle={referrer ? c.referrerHelp : c.friendHelp}
    >
      <ListRow
        raised
        icon={
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-ink-strong">
            <Glyph className="size-4" />
          </span>
        }
        label={rewardText(reward, c, fmt.money)}
        badge={
          <StatusChip tone={referrals.enabled ? 'success' : 'neutral'}>
            {referrals.enabled ? c.on : c.off}
          </StatusChip>
        }
        open={open === 'reward'}
        onToggle={() => toggle('reward')}
      >
        <ReferralRewardFields
          id={referrer ? 'referrer-reward' : 'friend-reward'}
          label={referrer ? c.referrerGets : c.friendGets}
          reward={reward}
          onChange={(next) =>
            onChange(referrer ? { referrerReward: next } : { friendReward: next })
          }
        />
      </ListRow>
      {referrer ? (
        <>
          {tagRow('tag', 'referrerTag', c.referrerTag)}
          <ListRow
            label={c.maxPerMember}
            value={referrals.maxPerMember === 0 ? undefined : c.upTo(referrals.maxPerMember)}
            empty={referrals.maxPerMember === 0}
            open={open === 'limit'}
            onToggle={() => toggle('limit')}
          >
            <NumberRow
              id="referral-max"
              label={c.maxPerMemberLabel}
              description={c.maxPerMemberHelp}
              value={referrals.maxPerMember}
              min={0}
              max={10_000}
              onChange={(maxPerMember) => onChange({ maxPerMember })}
            />
          </ListRow>
          <ListRow
            label={c.hold}
            description={c.holdHelp}
            trailing={
              <Switch
                aria-label={c.hold}
                checked={referrals.holdForReturns}
                onCheckedChange={(holdForReturns) => onChange({ holdForReturns })}
              />
            }
          />
        </>
      ) : (
        <>
          {tagRow('tag', 'friendTag', c.friendTag)}
          {tagRow('orderTag', 'orderTag', c.orderTag)}
          <ListRow
            label={c.codeDays}
            value={c.days(referrals.codeDays)}
            open={open === 'codeDays'}
            onToggle={() => toggle('codeDays')}
          >
            <NumberRow
              id="referral-code-days"
              label={c.codeDaysLabel}
              value={referrals.codeDays}
              min={1}
              max={365}
              onChange={(codeDays) => onChange({ codeDays })}
            />
          </ListRow>
        </>
      )}
    </ListSection>
  )
}
