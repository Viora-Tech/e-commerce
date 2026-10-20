'use client'

import ExportCourierConnectPage from '@/components/apps/shared/export-courier-connect-page'
import type { FieldValues } from '@/components/apps/shared/provider-settings'
import { dhlExpressAppContent } from '@/data/dhl-express'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const testConnection = (values: FieldValues) =>
  api.store.testDhlExpressConnection({ fields: values })

/** `/apps/dhl-express/connect`: guide, Test/Live switch, keys, export details and a read-only check. */
export default function ConnectPage() {
  // Hooks
  const copy = useCopy(dhlExpressAppContent)

  return (
    <ExportCourierConnectPage
      providerId="dhl-express"
      copy={copy.connect}
      keyField="apiKey"
      secretField="apiSecret"
      test={testConnection}
    />
  )
}
