import { DOCUMENT_KINDS, type DocumentKind } from '@commerce/core/document-templates'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import TemplateEditor from '@/components/documents/template-editor'
import { documentTemplatesContent } from '@/data/document-templates'
import { appRouter, call, serverContext } from '@/lib/api'
import { routes } from '@/lib/routes'
import { orNoStore } from '@/lib/store-guard'

export const metadata: Metadata = { title: documentTemplatesContent.title }

type Props = { params: Promise<{ kind: string }> }

const isKind = (k: string): k is DocumentKind => (DOCUMENT_KINDS as readonly string[]).includes(k)

/** One template's editor with its live preview. */
export default async function Page({ params }: Props) {
  const { kind } = await params
  if (!isKind(kind)) notFound()
  const context = await serverContext()
  const view = await call(appRouter.documents.templates, undefined, { context }).catch(
    orNoStore(undefined),
  )
  if (!view) redirect(routes.selectStore())
  const template = view.templates.find((t) => t.kind === kind)
  if (!template) notFound()
  return <TemplateEditor key={kind} template={template} store={view.store} gstApp={view.gstApp} />
}
