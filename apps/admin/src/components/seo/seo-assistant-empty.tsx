'use client'

import { SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import type { SeoAssistantState } from '@commerce/core/seo-assistant-service'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SeoAssistantEmptyProps = {
  state: Exclude<SeoAssistantState, 'ready'>
}

/** Why there are no rows yet, with the one step that fixes it. */
export default function SeoAssistantEmpty({ state }: SeoAssistantEmptyProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.states)

  // Early returns
  if (state === 'no_data') {
    return <EmptyState variant="page" heading={copy.noDataTitle} body={copy.noData} />
  }

  // Render logic
  const installed = state === 'not_connected'
  const href = installed
    ? routes.apps.page(SEARCH_CONSOLE_APP_ID, 'settings')
    : routes.apps.install(SEARCH_CONSOLE_APP_ID)

  return (
    <EmptyState
      variant="page"
      heading={installed ? copy.notConnectedTitle : copy.notInstalledTitle}
      body={installed ? copy.notConnected : copy.notInstalled}
      action={
        <Button render={<Link href={href} />}>
          {installed ? copy.openSettings : copy.install}
        </Button>
      }
    />
  )
}
