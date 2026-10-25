'use client'

import type { StoreAffiliateSettings } from '@commerce/plugin-affiliates/settings'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import NumberField from '@/components/apps/affiliates/number-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'

type Fraud = StoreAffiliateSettings['fraud']

type FraudCardProps = {
  value: Fraud
  onChange: (next: Fraud) => void
}

/** One site per line, without `https://` or a path; blank lines dropped. */
const sitesOf = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) =>
      l
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, ''),
    )
    .filter((l) => l.length >= 3)
    .slice(0, 100)

/** Settings › Fraud checks: the coupon sites a leaked code is spotted on, and the spike multiple. */
export default function FraudCard({ value, onChange }: FraudCardProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)

  // Render logic
  const f = copy.fraud

  return (
    <SettingsCard title={f.title} description={f.description}>
      <SettingsRow label={f.sites} description={f.sitesHelp} htmlFor="aff-fraud-sites">
        <Textarea
          id="aff-fraud-sites"
          rows={5}
          defaultValue={value.couponSites.join('\n')}
          onBlur={(e) => onChange({ ...value, couponSites: sitesOf(e.target.value) })}
        />
      </SettingsRow>
      <NumberField
        id="aff-fraud-spike"
        label={f.spike}
        description={f.spikeHelp}
        value={value.spikeMultiple}
        min={2}
        max={20}
        onChange={(spikeMultiple) =>
          onChange({ ...value, spikeMultiple: Math.min(20, Math.max(2, spikeMultiple)) })
        }
      />
    </SettingsCard>
  )
}
