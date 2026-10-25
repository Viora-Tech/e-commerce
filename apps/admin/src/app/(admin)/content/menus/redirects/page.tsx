import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import RedirectsList from '@/components/redirects/redirects-list'
import { appRouter, call, serverContext } from '@/lib/api'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: 'URL redirects' }

export default async function Page() {
  const context = await serverContext()
  const initial = await call(
    appRouter.redirects.list,
    { page: 1, perPage: siteConfig.ui.rowsPerPage.default, sort: 'newest' },
    { context },
  ).catch(orNoStore(undefined))
  if (!initial) redirect('/select-store')

  return <RedirectsList initial={initial} />
}
