'use client'

import type { StoreAffiliateSettings } from '@commerce/plugin-affiliates/settings'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import NumberField from '@/components/apps/affiliates/number-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AutoEnrol = StoreAffiliateSettings['autoEnrol']

type ShareAndEarnCardProps = {
  value: AutoEnrol
  onChange: (next: AutoEnrol) => void
}

type ProgramOption = { id: string; name: string; isDefault: boolean }

/** Settings › Share and earn: invite buyers to become affiliates, into which program, from what order value. */
export default function ShareAndEarnCard({ value, onChange }: ShareAndEarnCardProps) {
  // Hooks
  const { settings: copy } = useCopy(affiliatesContent)
  const [programs, setPrograms] = useState<ProgramOption[]>([])

  useEffect(() => {
    api.affiliates.programs
      .list()
      .then((rows) => setPrograms(rows.filter((p) => !p.archivedAt)))
      .catch(() => setPrograms([]))
  }, [])

  // Render logic
  const e = copy.enrol
  const on = value.mode === 'invite'

  return (
    <SettingsCard title={e.title} description={e.description}>
      <SettingsRow label={e.on} htmlFor="aff-enrol">
        <Switch
          id="aff-enrol"
          checked={on}
          onCheckedChange={(checked) => onChange({ ...value, mode: checked ? 'invite' : 'off' })}
        />
      </SettingsRow>
      {on ? (
        <SettingsRow label={e.program} description={e.programHelp} htmlFor="aff-enrol-program">
          <NativeSelect
            id="aff-enrol-program"
            value={value.programId ?? ''}
            onChange={(ev) => onChange({ ...value, programId: ev.target.value || null })}
          >
            {programs.map((p) => (
              <NativeSelectOption key={p.id} value={p.isDefault ? '' : p.id}>
                {p.isDefault ? e.defaultProgram(p.name) : p.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </SettingsRow>
      ) : null}
      {on ? (
        <NumberField
          id="aff-enrol-min"
          label={e.minOrder}
          description={e.minOrderHelp}
          value={value.minOrderPaise}
          scale={100}
          onChange={(minOrderPaise) => onChange({ ...value, minOrderPaise })}
        />
      ) : null}
    </SettingsCard>
  )
}
