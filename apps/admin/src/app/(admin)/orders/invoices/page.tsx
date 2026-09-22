import { FileText } from '@commerce/ui/icons'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ADMIN_APPS } from '@/apps/registry'
import PageBody from '@/components/layout/page-body'
import SectionEmpty from '@/components/layout/section-empty'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: gstInvoicesContent.list.title }

const List = ADMIN_APPS['gst-invoices']?.pages?.['/orders/invoices']

/** Issued GST documents; contributed by the GST invoices app. */
export default async function Page() {
  const context = await serverContext()
  const apps = await call(appRouter.apps.list, undefined, { context }).catch(() => undefined)
  if (apps === undefined) redirect('/select-store')
  const installed = apps.some((a) => a.id === 'gst-invoices' && a.installed)
  if (!installed || !List) {
    return (
      <SectionEmpty
        heading={gstInvoicesContent.list.title}
        body={gstInvoicesContent.list.notInstalled}
        action={{ label: gstInvoicesContent.settings.openApps, href: '/apps' }}
        icon={FileText}
      />
    )
  }
  return (
    <PageBody>
      <List />
    </PageBody>
  )
}
