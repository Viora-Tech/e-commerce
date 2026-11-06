import { loadEnv } from '@commerce/config'
import { apexRedirectOnly } from '@commerce/core'
import type { Metadata } from 'next'
import DomainsSettings from '@/components/domains/domains-settings'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Domains' }

export default async function Page() {
  const context = await serverContext()
  const domains = await call(appRouter.domains.list, undefined, { context })
  const redirectOnly = apexRedirectOnly(loadEnv(process.env).DOMAIN_PROVIDER)
  return <DomainsSettings domains={domains} apexRedirectOnly={redirectOnly} />
}
