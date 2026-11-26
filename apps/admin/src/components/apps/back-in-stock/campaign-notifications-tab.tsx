'use client'

import {
  ALERTS_PER_MINUTE_CHOICES,
  restockMinutes,
} from '@commerce/plugin-back-in-stock/settings-schema'
import { CheckIcon as Check } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import SwitchRow from '@/components/fields/switch-row'
import DataCard from '@/components/layout/data-card'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignTabProps } from './campaign-types'
import SelectField from './select-field'

/** The restock size the "Alerts per minute" hint is worked out for. */
const HINT_SIGNUPS = 500

/** The per-minute choices, plus a stored value set elsewhere (the API) so it still shows. */
function paceOptions(current: number): number[] {
  return [...new Set<number>([...ALERTS_PER_MINUTE_CHOICES, current])].sort((a, b) => a - b)
}

/**
 * Campaign › Notification settings: the campaign's name, when alerts go out, what the form
 * collects, the channels and the sending speed (Essential's first tab, on our channels).
 */
export default function CampaignNotificationsTab({ form, patch }: CampaignTabProps) {
  // Hooks
  const { campaign: copy } = useCopy(backInStockContent)

  // Render logic
  const minutes = restockMinutes(HINT_SIGNUPS, form.batchSize)

  return (
    <>
      <DataCard title={copy.campaignCard} bodyClassName="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="bis-title">{copy.titleLabel}</FieldLabel>
          <Input
            id="bis-title"
            value={form.title}
            maxLength={80}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <FieldDescription>{copy.titleHelp}</FieldDescription>
        </Field>
      </DataCard>
      <DataCard title={copy.sendCard} bodyClassName="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-body">
          <Check className="size-4 text-success" />
          {copy.sendWhen}
        </p>
        <p className="pl-6 text-caption text-muted-foreground">{copy.sendWhenHelp}</p>
      </DataCard>
      <DataCard title={copy.collectCard} bodyClassName="flex flex-col gap-3">
        <label htmlFor="bis-collect-email" className="flex items-start gap-2 text-body">
          <Checkbox id="bis-collect-email" checked disabled className="mt-0.5" />
          <span className="flex flex-col">
            {copy.collectEmail}
            <span className="text-caption text-muted-foreground">{copy.collectEmailHelp}</span>
          </span>
        </label>
        <label htmlFor="bis-collect-phone" className="flex items-start gap-2 text-body">
          <Checkbox
            id="bis-collect-phone"
            checked={form.askPhone}
            onCheckedChange={(on) => patch({ askPhone: on === true })}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            {copy.collectPhone}
            <span className="text-caption text-muted-foreground">{copy.collectPhoneHelp}</span>
          </span>
        </label>
      </DataCard>
      <DataCard title={copy.channelsCard} bodyClassName="flex flex-col gap-4">
        <SwitchRow
          id="bis-email"
          label={copy.emailEnabled}
          description={copy.emailHelp}
          checked={form.emailEnabled}
          onChange={(v) => patch({ emailEnabled: v })}
        />
        <SwitchRow
          id="bis-whatsapp"
          label={copy.whatsappEnabled}
          description={copy.whatsappHelp}
          checked={form.whatsappEnabled}
          onChange={(v) => patch({ whatsappEnabled: v })}
        />
      </DataCard>
      <DataCard title={copy.paceCard} bodyClassName="flex flex-col gap-4">
        <SelectField
          id="bis-batch"
          label={copy.batchSize}
          value={String(form.batchSize)}
          options={paceOptions(form.batchSize).map((n) => ({
            value: String(n),
            label: n.toLocaleString('en-IN'),
          }))}
          onChange={(v) => patch({ batchSize: Number(v) })}
          help={copy.batchSizeHint(HINT_SIGNUPS, minutes)}
        />
      </DataCard>
    </>
  )
}
