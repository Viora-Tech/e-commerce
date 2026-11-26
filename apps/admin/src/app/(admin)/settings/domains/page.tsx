import { loadEnv } from '@commerce/config'
import { apexRedirectOnly } from '@commerce/core'
import type { Metadata } from 'next'
import DomainsSettings from '@/components/domains/domains-settings'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Domains' }

export default async function Page() {
  const context = await serverContext()
  const domains = await call(appRouter.domains.list, undefined, { context })
  const env = loadEnv(process.env)
  const redirectOnly = apexRedirectOnly(env.DOMAIN_PROVIDER)
  const targets = { aRecord: env.STOREFRONT_A_RECORD, cnameTarget: env.STOREFRONT_CNAME_TARGET }
  return <DomainsSettings domains={domains} apexRedirectOnly={redirectOnly} targets={targets} />
}
