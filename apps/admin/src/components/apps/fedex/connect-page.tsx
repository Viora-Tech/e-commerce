'use client'

import ExportCourierConnectPage from '@/components/apps/shared/export-courier-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { fedexAppContent } from '@/data/fedex'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const testConnection = (values: FieldValues) => api.store.testFedexConnection({ fields: values })

/** `/apps/fedex/connect`: guide, Test/Live switch, keys, export details and a read-only check. */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(fedexAppContent)

  return (
    <ExportCourierConnectPage
      providerId="fedex"
      copy={copy.connect}
      keyField="clientId"
      secretField="clientSecret"
      test={testConnection}
    />
  )
}
