'use client'

import { Truck } from '@commerce/ui/icons'
import ProviderSettingsForm from '@/components/settings/provider-settings-form'
import { delhiveryAppContent as appCopy } from '@/data/delhivery'
import { api } from '@/lib/api-client'

const copy = appCopy.connect
const overviewCopy = appCopy.overview

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

/** Only Delhivery is offered here, whatever other couriers the store has enabled elsewhere. */
const load = async () => {
  const r = await api.store.getShipping()
  return { ...r, available: r.available.filter((p) => p.id === 'delhivery') }
}
const save = (next: Parameters<typeof api.store.updateShipping>[0]) =>
  api.store.updateShipping(next)

function webhookHint() {
  return (
    <p className="text-caption text-muted-foreground">
      {overviewCopy.webhookUrlHelp}{' '}
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
        {`${WORKER_URL}/webhooks/shipments/delhivery/<store id>`}
      </code>
    </p>
  )
}

/** The Delhivery app's own credentials screen, replacing the old Settings → Shipping entry. */
export default function ConnectPage() {
  return (
    <ProviderSettingsForm
      title={copy.title}
      icon={<Truck aria-hidden="true" />}
      intro={copy.intro}
      load={load}
      save={save}
      emptyExtra={{}}
      renderHint={webhookHint}
    />
  )
}
