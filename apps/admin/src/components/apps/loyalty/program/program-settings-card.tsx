'use client'

import type { LoyaltySettings } from '@commerce/core/loyalty'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import NumberRow from '@/components/apps/cod-rto/number-row'
import TagInput from '@/components/fields/tag-input'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { cleanEmails } from '@/lib/loyalty-program'
import ListRow from './list-row'
import ListSection from './list-section'

type ProgramSettingsCardProps = {
  settings: LoyaltySettings
  onChange: (patch: Partial<LoyaltySettings>) => void
}

type Row = 'name' | 'expiry' | 'tiers' | 'exclude' | 'test'

/** Reminder days when the switch turns the expiry emails back on (the v1 default). */
const REMINDER_ON = 14

/**
 * Loyalty settings as a list: points name, expiry, tier qualification, then our own rows
 * (expiry reminders, points at checkout, customers left out, test accounts). Rows expand in place.
 */
export default function ProgramSettingsCard({ settings, onChange }: ProgramSettingsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const [open, setOpen] = useState<Row | null>(null)

  // Helpers
  const toggle = (row: Row) => setOpen((o) => (o === row ? null : row))

  // Render logic
  const c = copy.settings
  const s = settings

  return (
    <ListSection title={c.heading} subtitle={c.help}>
      <ListRow
        raised
        label={c.pointsName}
        value={`${s.pointsNameSingular} / ${s.pointsNamePlural}`}
        open={open === 'name'}
        onToggle={() => toggle('name')}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="loyalty-name-one">{c.nameSingular}</FieldLabel>
            <Input
              id="loyalty-name-one"
              size="lg"
              maxLength={30}
              value={s.pointsNameSingular}
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
              value={s.pointsNamePlural}
              onChange={(e) => onChange({ pointsNamePlural: e.target.value })}
            />
          </Field>
        </div>
      </ListRow>
      <ListRow
        label={c.expiry}
        value={s.expiryMonths === 0 ? c.never : c.months(s.expiryMonths)}
        open={open === 'expiry'}
        onToggle={() => toggle('expiry')}
      >
        <NumberRow
          id="loyalty-expiry"
          label={c.expiryLabel}
          description={c.expiryHelp}
          value={s.expiryMonths}
          min={0}
          max={60}
          onChange={(expiryMonths) => onChange({ expiryMonths })}
        />
      </ListRow>
      <ListRow
        label={c.reminders}
        description={c.remindersHelp}
        trailing={
          <Switch
            aria-label={c.reminders}
            checked={s.reminderDays > 0}
            onCheckedChange={(on) => onChange({ reminderDays: on ? REMINDER_ON : 0 })}
          />
        }
      />
      <ListRow
        label={c.tierQualification}
        value={c.qualification(
          s.tierBasis === 'spend' ? c.tierBasisSpend : c.tierBasisPoints,
          s.tierWindow === 'rolling_12m' ? c.tierWindowRolling : c.tierWindowLifetime,
        )}
        open={open === 'tiers'}
        onToggle={() => toggle('tiers')}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="loyalty-tier-basis">{c.tierBasis}</FieldLabel>
            <NativeSelect
              id="loyalty-tier-basis"
              value={s.tierBasis}
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
              value={s.tierWindow}
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
      </ListRow>
      <ListRow
        label={c.storeCredit}
        description={c.storeCreditHelp}
        trailing={
          <Switch
            aria-label={c.storeCredit}
            checked={s.pointsAsStoreCredit}
            onCheckedChange={(pointsAsStoreCredit) => onChange({ pointsAsStoreCredit })}
          />
        }
      />
      <ListRow
        label={c.excludeTags}
        value={s.excludeTags.length === 0 ? c.none : s.excludeTags.join(', ')}
        empty={s.excludeTags.length === 0}
        open={open === 'exclude'}
        onToggle={() => toggle('exclude')}
      >
        <Field>
          <TagInput
            id="loyalty-exclude-tags"
            tags={s.excludeTags}
            suggestions={[]}
            placeholder={c.customerTagPlaceholder}
            onChange={(excludeTags) => onChange({ excludeTags })}
          />
          <FieldDescription>{c.excludeTagsHelp}</FieldDescription>
        </Field>
      </ListRow>
      <ListRow
        label={c.testEmails}
        value={s.testEmails.length === 0 ? c.none : c.accounts(s.testEmails.length)}
        empty={s.testEmails.length === 0}
        open={open === 'test'}
        onToggle={() => toggle('test')}
      >
        <Field>
          <TagInput
            id="loyalty-test-emails"
            tags={s.testEmails}
            suggestions={[]}
            placeholder={c.emailPlaceholder}
            onChange={(list) => onChange({ testEmails: cleanEmails(list) })}
          />
          <FieldDescription>{c.testEmailsHelp}</FieldDescription>
        </Field>
      </ListRow>
    </ListSection>
  )
}
