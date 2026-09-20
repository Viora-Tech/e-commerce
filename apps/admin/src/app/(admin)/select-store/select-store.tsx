'use client'

import { BlockStack, Button, Card, EmptyState, Page, Text } from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function SelectStore({ stores }: { stores: { id: string; name: string; slug: string }[] }) {
  const router = useRouter()
  async function pick(id: string) {
    await authClient.organization.setActive({ organizationId: id })
    router.push('/')
    router.refresh()
  }
  return (
    <Page title="Choose a store" narrowWidth>
      {stores.length === 0 ? (
        <Card>
          <EmptyState heading="No stores yet" image="">
            <p>Store creation lands with onboarding. Ask an owner to invite you.</p>
          </EmptyState>
        </Card>
      ) : (
        <BlockStack gap="400">
          {stores.map((s) => (
            <Card key={s.id}>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  {s.name}
                </Text>
                <Text as="p" tone="subdued">
                  {s.slug}
                </Text>
                <div>
                  <Button variant="primary" onClick={() => pick(s.id)}>
                    Open {s.name}
                  </Button>
                </div>
              </BlockStack>
            </Card>
          ))}
        </BlockStack>
      )}
    </Page>
  )
}
