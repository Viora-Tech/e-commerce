import type { Metadata } from 'next'
import TaxesGstPage from '@/components/settings/taxes/taxes-gst-page'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'GST & invoices' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.businessGst.get, undefined, { context })
  return <TaxesGstPage view={view} />
}
