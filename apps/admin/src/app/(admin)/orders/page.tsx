'use client'

import { Card, EmptyState, Page } from '@shopify/polaris'

export default function Placeholder() {
  return (
    <Page title="Orders">
      <Card>
        <EmptyState heading="Orders" image="">
          <p>Coming in a later PR.</p>
        </EmptyState>
      </Card>
    </Page>
  )
}
