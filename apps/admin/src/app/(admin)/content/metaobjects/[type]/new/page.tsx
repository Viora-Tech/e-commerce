import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EntryForm from '@/components/metaobjects/entry-form'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: metaobjectListContent.heading }

type Props = { params: Promise<{ type: string }> }

export default async function Page({ params }: Props) {
  const { type } = await params
  const context = await serverContext()
  const definition = await call(appRouter.metaobjects.definition, { type }, { context }).catch(
    () => null,
  )
  if (!definition) notFound()
  return <EntryForm definition={definition} entry={null} title={null} />
}
