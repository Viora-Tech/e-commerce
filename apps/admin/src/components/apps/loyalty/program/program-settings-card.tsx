'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import NumberRow from '@/components/apps/cod-rto/number-row'
import SwitchRow from '@/components/fields/switch-row'
import TagInput from '@/components/fields/tag-input'
import SettingsCard from '@/components/settings/settings-card'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { cleanEmails } from '@/lib/loyalty-program'

type ProgramSettingsCardProps = {
  settings: LoyaltySettings
  onChange: (patch: Partial<LoyaltySettings>) => void
}

/** Reminder days when the switch turns the expiry emails back on (the v1 default). */
const REMINDER_ON = 14

/** Loyalty settings: points name, expiry, tier qualification, store credit, who takes part. */
export default function ProgramSettingsCard({ settings, onChange }: ProgramSettingsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Render logic
  const c = copy.settings

  return (
    <SettingsCard title={c.heading} description={c.help}>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="loyalty-name-one">{c.nameSingular}</FieldLabel>
          <Input
            id="loyalty-name-one"
            size="lg"
            maxLength={30}
            value={settings.pointsNameSingular}
            onChange={(e) => onChange({ pointsNameSingular: e.target.value })}
          />
          <FieldDescription>{c.nameHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="loyalty-name-many">{c.namePlural}</FieldLabel>
          <Input
            id="loyalty-name-many"
            size="lg"
            maxLength={30}
            value={settings.pointsNamePlural}
            onChange={(e) => onChange({ pointsNamePlural: e.target.value })}
          />
        </Field>
      </div>
      <NumberRow
        id="loyalty-expiry"
        label={c.expiry}
        description={c.expiryHelp}
        value={settings.expiryMonths}
        min={0}
        max={60}
        onChange={(expiryMonths) => onChange({ expiryMonths })}
      />
      <SwitchRow
        label={c.reminders}
        description={c.remindersHelp}
        checked={settings.reminderDays > 0}
        onChange={(on) => onChange({ reminderDays: on ? REMINDER_ON : 0 })}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="loyalty-tier-basis">{c.tierBasis}</FieldLabel>
          <NativeSelect
            id="loyalty-tier-basis"
            value={settings.tierBasis}
            onChange={(e) =>
              onChange({ tierBasis: e.target.value === 'spend' ? 'spend' : 'points' })
            }
          >
            <NativeSelectOption value="points">{c.tierBasisPoints}</NativeSelectOption>
            <NativeSelectOption value="spend">{c.tierBasisSpend}</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="loyalty-tier-window">{c.tierWindow}</FieldLabel>
          <NativeSelect
            id="loyalty-tier-window"
            value={settings.tierWindow}
            onChange={(e) =>
              onChange({
                tierWindow: e.target.value === 'rolling_12m' ? 'rolling_12m' : 'lifetime',
              })
            }
          >
            <NativeSelectOption value="lifetime">{c.tierWindowLifetime}</NativeSelectOption>
            <NativeSelectOption value="rolling_12m">{c.tierWindowRolling}</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <SwitchRow
        label={c.storeCredit}
        description={c.storeCreditHelp}
        checked={settings.pointsAsStoreCredit}
        onChange={(pointsAsStoreCredit) => onChange({ pointsAsStoreCredit })}
      />
      <Field>
        <FieldLabel htmlFor="loyalty-exclude-tags">{c.excludeTags}</FieldLabel>
        <TagInput
          id="loyalty-exclude-tags"
          tags={settings.excludeTags}
          suggestions={[]}
          placeholder={c.customerTagPlaceholder}
          onChange={(excludeTags) => onChange({ excludeTags })}
        />
        <FieldDescription>{c.excludeTagsHelp}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="loyalty-test-emails">{c.testEmails}</FieldLabel>
        <TagInput
          id="loyalty-test-emails"
          tags={settings.testEmails}
          suggestions={[]}
          placeholder={c.emailPlaceholder}
          onChange={(list) => onChange({ testEmails: cleanEmails(list) })}
        />
        <FieldDescription>{c.testEmailsHelp}</FieldDescription>
      </Field>
    </SettingsCard>
  )
}
