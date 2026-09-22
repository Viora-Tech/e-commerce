'use client'

import ProviderSettingsForm, {
  type ProviderDef,
} from '@/components/settings/provider-settings-form'
import StorageVerify from '@/components/settings/storage-verify'
import { mediaContent } from '@/data/media'
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
  return <StorageVerify />
}

export default function FilesSettings() {
  return (
    <ProviderSettingsForm<Extra>
      title={copy.title}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={providerHint}
      renderFooter={footer}
      noConfigText={copy.hints.local}
    />
  )
}
