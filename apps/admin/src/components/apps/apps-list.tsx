'use client'

import { Banner, BlockStack, Layout, Page, Text, Toast } from '@shopify/polaris'
import { useEffect, useState } from 'react'
import { appsContent as copy } from '@/data/apps'
import { api } from '@/lib/api-client'
import { AppCard, type AppSummary } from './app-card'

type Status = { toast?: string | undefined; error?: string | undefined }

function describeError(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback
}

export function AppsList() {
  const [apps, setApps] = useState<AppSummary[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>({})

  useEffect(() => {
    api.apps
      .list()
      .then(setApps)
      .catch((err) => setStatus({ error: describeError(err, copy.loadFailed) }))
  }, [])

  const handleToggle = async (app: AppSummary, install: boolean) => {
    setBusyId(app.id)
    setStatus({})
    try {
      if (install) await api.apps.install({ id: app.id })
      else await api.apps.uninstall({ id: app.id })
      setApps(await api.apps.list())
      setStatus({
        toast: install ? copy.installedToast(app.name) : copy.uninstalledToast(app.name),
      })
    } catch (err) {
      setStatus({ error: describeError(err, copy.actionFailed) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Page title={copy.title}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              {copy.intro}
            </Text>
            {status.error ? (
              <Banner tone="critical" title={copy.actionFailed}>
                {status.error}
              </Banner>
            ) : null}
            {apps?.length === 0 ? (
              <Text as="p" tone="subdued">
                {copy.empty}
              </Text>
            ) : null}
            {apps?.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                busy={busyId === app.id}
                onInstall={(a) => handleToggle(a, true)}
                onUninstall={(a) => handleToggle(a, false)}
              />
            ))}
            <Text as="p" tone="subdued" variant="bodySm">
              {copy.docs}
            </Text>
          </BlockStack>
        </Layout.Section>
      </Layout>
      {status.toast ? (
        <Toast content={status.toast} onDismiss={() => setStatus({})} duration={3000} />
      ) : null}
    </Page>
  )
}
