import { entryDisplayName } from '@commerce/core/metaobjects'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EntryForm from '@/components/metaobjects/entry-form'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: metaobjectListContent.heading }

type Props = { params: Promise<{ type: string; id: string }> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: Props) {
  const { type, id } = await params
  if (!UUID.test(id)) notFound()
  const context = await serverContext()
  const [definition, entry] = await Promise.all([
    call(appRouter.metaobjects.definition, { type }, { context }).catch(() => null),
    call(appRouter.metaobjects.entry, { id }, { context }).catch(() => null),
  ])
  if (!definition || !entry || entry.definitionId !== definition.id) notFound()
  return (
    <EntryForm
      definition={definition}
      entry={entry}
      title={entryDisplayName(definition.displayNameKey, entry.fields, entry.handle)}
    />
  )
}
