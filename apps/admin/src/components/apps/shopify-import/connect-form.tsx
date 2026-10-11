'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import AppCredentialsForm from './app-credentials-form'
import LegacyTokenForm from './legacy-token-form'

type Connection = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.connect>>>

type ConnectFormProps = {
  onConnected: (connection: Connection) => void
}

/** The two ways to connect: a Dev Dashboard app (recommended) or an existing custom-app token. */
export default function ConnectForm({ onConnected }: ConnectFormProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const [mode, setMode] = useState<'app' | 'token'>('app')

  // Render logic
  const isMode = (value: string): value is 'app' | 'token' => value === 'app' || value === 'token'

  return (
    <Tabs value={mode} onValueChange={(v) => isMode(v) && setMode(v)}>
      <TabsList className="w-full max-w-3xl">
        <TabsTrigger value="app" className="gap-2">
          {copy.mode.app}
          <Badge variant="secondary">{copy.app.badge}</Badge>
        </TabsTrigger>
        <TabsTrigger value="token">{copy.mode.token}</TabsTrigger>
      </TabsList>
      <TabsContent value="app" className="pt-4">
        <AppCredentialsForm onConnected={onConnected} />
      </TabsContent>
      <TabsContent value="token" className="max-w-3xl pt-4">
        <LegacyTokenForm onConnected={onConnected} />
      </TabsContent>
    </Tabs>
  )
}
