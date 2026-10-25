'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useEffect, useState } from 'react'
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

const MODES: readonly Mode[] = ['install', 'app', 'token']

const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value)

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
    <Tabs value={mode} onValueChange={(v) => isMode(v) && setMode(v)}>
      <TabsList className="w-full">
        {installable ? (
          <TabsTrigger value="install" className="gap-2">
            {copy.mode.install}
            <Badge variant="secondary">{install.badge}</Badge>
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="app" className="gap-2">
          {copy.mode.app}
          {installable ? null : <Badge variant="secondary">{copy.app.badge}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="token">{copy.mode.token}</TabsTrigger>
      </TabsList>
      {installable ? (
        <TabsContent value="install" className="pt-4">
          <AppInstallForm />
        </TabsContent>
      ) : null}
      <TabsContent value="app" className="pt-4">
        <AppCredentialsForm onConnected={onConnected} />
      </TabsContent>
      <TabsContent value="token" className="pt-4">
        <LegacyTokenForm onConnected={onConnected} />
      </TabsContent>
    </Tabs>
  )
}
