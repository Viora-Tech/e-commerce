'use client'

import { Images } from '@commerce/ui/icons'
import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import SettingsSection from '@/components/settings/settings-section'
import StorageVerify from '@/components/settings/storage-verify'
import { mediaContent } from '@/data/media'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

const copy = mediaContent.settings

type Extra = Record<never, never>

const load = () => api.store.getStorage()
const save = (next: Parameters<typeof api.store.updateStorage>[0]) => api.store.updateStorage(next)

function providerHint(m: ProviderDef) {
  const hint = copy.hints[m.id]
  return hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null
}

function footer() {
  return (
    <SettingsSection id={settingsContent.sections.files[1]?.id ?? 'section-verify'}>
      <StorageVerify />
    </SettingsSection>
  )
}

export default function FilesSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      back={copy.back}
      icon={<Images aria-hidden="true" />}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={providerHint}
      renderFooter={footer}
      noConfigText={copy.hints.local}
      sections={settingsContent.sections.files}
    />
  )
}
