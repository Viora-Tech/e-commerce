'use client'

import { Card, EmptyState, Page } from '@shopify/polaris'

export default function Placeholder() {
  return (
    <Page title="Settings">
      <Card>
        <EmptyState heading="Settings" image="">
          <p>Coming in a later PR.</p>
        </EmptyState>
      </Card>
    </Page>
  )
}
