import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DefinitionForm from '@/components/metaobjects/definition-form'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getCopy(metaobjectListContent)).heading }
}

type Props = { params: Promise<{ type: string }> }

export default async function Page({ params }: Props) {
  const { type } = await params
  const context = await serverContext()
  const [definition, definitions] = await Promise.all([
    call(appRouter.metaobjects.definition, { type }, { context }).catch(() => null),
    call(appRouter.metaobjects.definitions, undefined, { context }),
  ])
  if (!definition) notFound()
  return (
    <DefinitionForm
      definition={definition}
      targets={definitions.map((d) => ({ id: d.id, name: d.name }))}
    />
  )
}
