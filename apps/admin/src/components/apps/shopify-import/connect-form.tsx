'use client'

import { useEffect, useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import StatusChip from '@/components/layout/status-chip'
import { shopifyAppInstallContent } from '@/data/shopify-app-install'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import AppCredentialsForm from './app-credentials-form'
import AppInstallForm from './app-install-form'
import LegacyTokenForm from './legacy-token-form'

type Connection = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.connect>>>

type ConnectFormProps = {
  onConnected: (connection: Connection) => void
}

type Mode = 'install' | 'app' | 'token'

/**
 * The ways to connect: the Koomerce app on Shopify (one click, when this deployment has it),
 * a Dev Dashboard app the merchant makes, or an existing custom-app token.
 */
export default function ConnectForm({ onConnected }: ConnectFormProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const install = useCopy(shopifyAppInstallContent)
  const [installable, setInstallable] = useState(false)
  const [mode, setMode] = useState<Mode>('app')

  useEffect(() => {
    api.shopifyImport
      .appInstall()
      .then((r) => {
        setInstallable(r.available)
        if (r.available) setMode('install')
      })
      .catch(() => setInstallable(false))
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <PillTabs
        variant="segmented"
        className="max-w-full"
        value={mode}
        onChange={setMode}
        tabs={[
          ...(installable
            ? [
                {
                  value: 'install' as const,
                  label: (
                    <>
                      {copy.mode.install}
                      <StatusChip dot={false}>{install.badge}</StatusChip>
                    </>
                  ),
                },
              ]
            : []),
          {
            value: 'app' as const,
            label: (
              <>
                {copy.mode.app}
                {installable ? null : <StatusChip dot={false}>{copy.app.badge}</StatusChip>}
              </>
            ),
          },
          { value: 'token' as const, label: copy.mode.token },
        ]}
      />
      <div className="pt-4">
        {mode === 'install' && installable ? <AppInstallForm /> : null}
        {mode === 'app' ? <AppCredentialsForm onConnected={onConnected} /> : null}
        {mode === 'token' ? <LegacyTokenForm onConnected={onConnected} /> : null}
      </div>
    </div>
  )
}
