'use client'

import {
  type LoyaltySettings,
  REFERRAL_SHARE_CHANNELS,
  type ReferralShareChannel,
} from '@commerce/core/loyalty'
import { ShieldCheck } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import NumberRow from '@/components/apps/cod-rto/number-row'
import SwitchRow from '@/components/fields/switch-row'
import DataCard from '@/components/layout/data-card'
import SettingsCard from '@/components/settings/settings-card'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import ReferralRewardFields from './referral-reward-fields'

type Referrals = LoyaltySettings['referrals']

type ReferralsTabProps = {
  referrals: Referrals
  onChange: (referrals: Referrals) => void
}

const TAGS = ['referrerTag', 'friendTag', 'orderTag'] as const

/** The Referrals part of the Program page: on/off, both rewards, limits, tags, share buttons, fraud checks. */
export default function ReferralsTab({ referrals, onChange }: ReferralsTabProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Helpers
  const set = (patch: Partial<Referrals>) => onChange({ ...referrals, ...patch })

  // Event handlers
  const handleChannel = (channel: ReferralShareChannel, on: boolean) =>
    set({
      shareChannels: REFERRAL_SHARE_CHANNELS.filter((c) =>
        c === channel ? on : referrals.shareChannels.includes(c),
      ),
    })

  // Render logic
  const c = copy.referrals

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={c.heading} description={c.help}>
        <SwitchRow
          label={c.enabled}
          description={c.enabledHelp}
          checked={referrals.enabled}
          onChange={(enabled) => set({ enabled })}
        />
        <ReferralRewardFields
          id="referrer-reward"
          label={c.referrer}
          reward={referrals.referrerReward}
          onChange={(referrerReward) => set({ referrerReward })}
        />
        <ReferralRewardFields
          id="friend-reward"
          label={c.friend}
          reward={referrals.friendReward}
          onChange={(friendReward) => set({ friendReward })}
        />
        <NumberRow
          id="referral-code-days"
          label={c.codeDays}
          value={referrals.codeDays}
          min={1}
          max={365}
          onChange={(codeDays) => set({ codeDays })}
        />
      </SettingsCard>
      <SettingsCard title={c.limits}>
        <NumberRow
          id="referral-max"
          label={c.maxPerMember}
          description={c.maxPerMemberHelp}
          value={referrals.maxPerMember}
          min={0}
          max={10_000}
          onChange={(maxPerMember) => set({ maxPerMember })}
        />
        <SwitchRow
          label={c.hold}
          description={c.holdHelp}
          checked={referrals.holdForReturns}
          onChange={(holdForReturns) => set({ holdForReturns })}
        />
      </SettingsCard>
      <SettingsCard title={c.tags} description={c.tagHelp}>
        <div className="grid gap-5 sm:grid-cols-3">
          {TAGS.map((key) => (
            <Field key={key}>
              <FieldLabel htmlFor={`referral-${key}`}>{c[key]}</FieldLabel>
              <Input
                id={`referral-${key}`}
                size="lg"
                maxLength={60}
                value={referrals[key]}
                onChange={(e) => set({ [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title={c.share} description={c.shareHelp}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REFERRAL_SHARE_CHANNELS.map((channel) => (
            <Field key={channel} orientation="horizontal">
              <Checkbox
                id={`share-${channel}`}
                checked={referrals.shareChannels.includes(channel)}
                onCheckedChange={(on) => handleChannel(channel, Boolean(on))}
              />
              <FieldLabel htmlFor={`share-${channel}`} className="font-normal">
                {c.channels[channel]}
              </FieldLabel>
            </Field>
          ))}
        </div>
      </SettingsCard>
      <DataCard
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" />
            {c.fraud}
          </span>
        }
      >
        <div className="flex flex-col gap-2">
          <FieldDescription>{c.fraudHelp}</FieldDescription>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-foreground">
            {c.checks.map((check) => (
              <li key={check}>{check}</li>
            ))}
          </ul>
        </div>
      </DataCard>
    </div>
  )
}
