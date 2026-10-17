'use client'

import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import LanguageField from '@/components/settings/language-field'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { accountContent } from '@/data/account'
import { useCopy, useRegion } from '@/hooks/use-copy'
import { localize } from '@/lib/copy'
import { loadHindi } from '@/lib/hindi'
import type { Locale } from '@/lib/i18n'
import { CLOCKS, type Region, regionCookie, WEEK_STARTS } from '@/lib/region'

/**
 * Account → Language & region: the admin language, 12- or 24-hour times and the first day of
 * the week. All three are cookies on this browser, read by the root layout, so the change
 * shows on the next render without a save button.
 */
export default function LanguageRegionPage() {
  // Hooks
  const copy = useCopy(accountContent)
  const region = useRegion()
  const router = useRouter()

  // Helpers
  const saveRegion = (next: Region) => {
    // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
    document.cookie = regionCookie(next)
    router.refresh()
    toast.success(copy.region.saved)
  }

  // Event handlers
  // The toast speaks the new language (Hindi's copy loads on demand): the page itself switches
  // when the refresh lands.
  const handleLanguage = async (next: Locale) => {
    if (next === 'hi') await loadHindi()
    toast.success(localize(accountContent, next).language.saved)
  }

  const handleClock = (values: string[]) => {
    const clock = CLOCKS.find((c) => c === values[0])
    if (clock && clock !== region.clock) saveRegion({ ...region, clock })
  }

  const handleWeekStart = (values: string[]) => {
    const weekStart = WEEK_STARTS.find((w) => w === values[0])
    if (weekStart && weekStart !== region.weekStart) saveRegion({ ...region, weekStart })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.language.title} subtitle={copy.language.intro} />
      <SettingsCard
        title={copy.language.heading}
        description={copy.language.body}
        bodyClassName="flex flex-col gap-3"
      >
        <LanguageField onChanged={handleLanguage} />
        <p className="text-caption text-muted-foreground">{copy.language.partial}</p>
      </SettingsCard>
      <SettingsCard title={copy.region.heading} description={copy.region.body}>
        <SettingsRow label={copy.region.clock.label} description={copy.region.clock.help}>
          <ToggleGroup
            aria-label={copy.region.clock.label}
            value={[region.clock]}
            onValueChange={handleClock}
            variant="outline"
            spacing={0}
          >
            {CLOCKS.map((id) => (
              <ToggleGroupItem key={id} value={id} className="px-3">
                {copy.region.clock.options[id]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingsRow>
        <SettingsRow label={copy.region.weekStart.label} description={copy.region.weekStart.help}>
          <ToggleGroup
            aria-label={copy.region.weekStart.label}
            value={[region.weekStart]}
            onValueChange={handleWeekStart}
            variant="outline"
            spacing={0}
          >
            {WEEK_STARTS.map((id) => (
              <ToggleGroupItem key={id} value={id} className="px-3">
                {copy.region.weekStart.options[id]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SettingsRow>
      </SettingsCard>
    </div>
  )
}
