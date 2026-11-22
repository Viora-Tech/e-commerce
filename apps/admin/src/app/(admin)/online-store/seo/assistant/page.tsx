import type { Metadata } from 'next'
import SeoAssistantPage from '@/components/seo/seo-assistant-page'
import ServerLoadFailed from '@/components/states/server-load-failed'
import { seoAssistantContent } from '@/data/seo-assistant'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { didFail, loadFailure } from '@/lib/load-failure'

export const metadata: Metadata = { title: 'Search opportunities' }

export default async function Page() {
  const context = await serverContext()
  const [view, ai, copy] = await Promise.all([
    call(appRouter.seo.assistant, undefined, { context }).catch(loadFailure),
    call(appRouter.ai.status, undefined, { context }).catch(() => null),
    getCopy(seoAssistantContent),
  ])

  if (didFail(view)) return <ServerLoadFailed failed={view.failed} heading={copy.loadFailed} />
  return <SeoAssistantPage view={view} aiOn={ai?.productWriter ?? false} />
}
