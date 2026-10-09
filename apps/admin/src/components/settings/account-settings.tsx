'use client'

import { toast } from 'sonner'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import { localize } from '@/lib/copy'
import type { Locale } from '@/lib/i18n'
import LanguageField from './language-field'
import SettingsCard from './settings-card'
import SettingsPageHeader from './settings-page-header'

/** Account (from the account menu): preferences that belong to the signed-in member, starting with language. */
export default function AccountSettings() {
  // Hooks
  const copy = useCopy(accountContent)

  // Event handlers
  // The toast speaks the new language: the page itself switches when the refresh lands.
  const handleChanged = (next: Locale) =>
    toast.success(localize(accountContent, next).language.saved)

  return (
    <div className="flex flex-col gap-4">
      <SettingsPageHeader title={copy.title} subtitle={copy.intro} hideBack />
      <SettingsCard
        title={copy.language.heading}
        description={copy.language.body}
        bodyClassName="flex flex-col gap-3"
      >
        <LanguageField onChanged={handleChanged} />
        <p className="text-caption text-muted-foreground">{copy.language.partial}</p>
      </SettingsCard>
    </div>
  )
}
