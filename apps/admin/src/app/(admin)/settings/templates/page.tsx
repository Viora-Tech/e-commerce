import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import TemplatesList from '@/components/documents/templates-list'
import { documentTemplatesContent } from '@/data/document-templates'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: documentTemplatesContent.title }

/** Settings › Printed documents: the packing slip, pick list and invoice templates. */
export default async function Page() {
  const context = await serverContext()
  const view = await call(appRouter.documents.templates, undefined, { context }).catch(
    orNoStore(undefined),
  )
  if (!view) redirect(routes.selectStore())
  return <TemplatesList templates={view.templates} gstApp={view.gstApp} />
}
