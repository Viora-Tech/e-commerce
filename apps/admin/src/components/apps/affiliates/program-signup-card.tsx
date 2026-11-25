'use client'

import type { ProgramRules } from '@commerce/plugin-affiliates/settings'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { useCopy } from '@/hooks/use-copy'

type ProgramSignupCardProps = {
  isDefault: boolean
  /** The full signup link as it reads now. */
  link: string
  slug: string
  rules: ProgramRules
  onSlug: (slug: string) => void
  onChange: (patch: Partial<ProgramRules>) => void
}

/** Program editor › Other settings › Signup page: the link, who approves signups and the terms. */
export default function ProgramSignupCard({
  isDefault,
  link,
  slug,
  rules,
  onSlug,
  onChange,
}: ProgramSignupCardProps) {
  // Hooks
  const { editor } = useCopy(affiliatesLayoutContent)
  const { program: c, settings: s } = useCopy(affiliatesContent)

  // Render logic
  return (
    <SettingsCard title={editor.signup}>
      {isDefault ? (
        <SettingsRow label={c.link} description={c.defaultLink}>
          <span className="break-all font-mono text-body">{link}</span>
        </SettingsRow>
      ) : (
        <SettingsRow label={c.slug} description={c.slugHelp} htmlFor="aff-program-slug">
          <div className="flex flex-col gap-1">
            <Input
              id="aff-program-slug"
              maxLength={40}
              value={slug}
              onChange={(e) => onSlug(e.target.value.toLowerCase())}
            />
            <span className="break-all font-mono text-caption text-muted-foreground">{link}</span>
          </div>
        </SettingsRow>
      )}
      <SettingsRow label={s.approval} htmlFor="aff-approval">
        <NativeSelect
          id="aff-approval"
          value={rules.approval}
          onChange={(e) => onChange({ approval: e.target.value === 'auto' ? 'auto' : 'manual' })}
        >
          <NativeSelectOption value="manual">{s.approvalManual}</NativeSelectOption>
          <NativeSelectOption value="auto">{s.approvalAuto}</NativeSelectOption>
        </NativeSelect>
      </SettingsRow>
      <SettingsRow label={s.terms} description={s.termsHelp} htmlFor="aff-terms">
        <Textarea
          id="aff-terms"
          rows={6}
          maxLength={10_000}
          value={rules.terms}
          onChange={(e) => onChange({ terms: e.target.value })}
        />
      </SettingsRow>
    </SettingsCard>
  )
}
