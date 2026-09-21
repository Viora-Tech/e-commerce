'use client'

import { Badge, BlockStack, Button, Card, InlineStack, Text } from '@shopify/polaris'
import Link from 'next/link'
import { type AppKind, appsContent as copy } from '@/data/apps'

export type AppSummary = {
  id: string
  name: string
  version: string
  description: string | null
  builtIn: boolean
  installed: boolean
  provides: Record<AppKind, { id: string; label: string }[]>
}

type AppCardProps = {
  app: AppSummary
  busy: boolean
  onInstall: (app: AppSummary) => void
  onUninstall: (app: AppSummary) => void
}

const KINDS = Object.keys(copy.kinds) as AppKind[]

/** Kinds this plugin contributes to, in settings-page order. */
function providedKinds(app: AppSummary): AppKind[] {
  return KINDS.filter((k) => app.provides[k].length > 0)
}

export function AppCard({ app, busy, onInstall, onUninstall }: AppCardProps) {
  const kinds = providedKinds(app)

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start" gap="400">
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h2" variant="headingSm">
                {app.name}
              </Text>
              <Text as="span" tone="subdued" variant="bodySm">
                {copy.version(app.version)}
              </Text>
              {app.builtIn ? (
                <Badge>{copy.builtIn}</Badge>
              ) : app.installed ? (
                <Badge tone="success">{copy.installed}</Badge>
              ) : null}
            </InlineStack>
            {app.description ? (
              <Text as="p" tone="subdued">
                {app.description}
              </Text>
            ) : null}
          </BlockStack>
          {app.builtIn ? null : app.installed ? (
            <Button loading={busy} onClick={() => onUninstall(app)}>
              {copy.uninstall}
            </Button>
          ) : (
            <Button variant="primary" loading={busy} onClick={() => onInstall(app)}>
              {copy.install}
            </Button>
          )}
        </InlineStack>

        <InlineStack gap="200" blockAlign="center">
          {kinds.map((k) => (
            <Badge key={k} tone="info">
              {`${copy.kinds[k].label}: ${app.provides[k].map((p) => p.label).join(', ')}`}
            </Badge>
          ))}
        </InlineStack>

        {app.installed ? (
          <InlineStack gap="300">
            {kinds.map((k) => (
              <Link key={k} href={copy.kinds[k].href}>
                {copy.configure(copy.kinds[k].label)}
              </Link>
            ))}
          </InlineStack>
        ) : null}
      </BlockStack>
    </Card>
  )
}
