import type { Metadata } from 'next'
import BusinessGstSettings from '@/components/settings/business-gst/business-gst-settings'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Business and GST' }

export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.businessGst.get, undefined, { context })
  return <BusinessGstSettings view={view} />
}
