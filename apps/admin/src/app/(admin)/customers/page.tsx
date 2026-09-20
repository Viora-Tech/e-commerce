'use client'

import { Card, EmptyState, Page } from '@shopify/polaris'

export default function Placeholder() {
  return (
    <Page title="Customers">
      <Card>
        <EmptyState heading="Customers" image="">
          <p>Coming in a later PR.</p>
        </EmptyState>
      </Card>
    </Page>
  )
}
