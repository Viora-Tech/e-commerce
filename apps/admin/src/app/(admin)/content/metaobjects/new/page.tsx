import type { Metadata } from 'next'
import DefinitionForm from '@/components/metaobjects/definition-form'
import { definitionFormContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: definitionFormContent.newTitle }

export default async function Page() {
  const context = await serverContext()
  const definitions = await call(appRouter.metaobjects.definitions, undefined, { context })
  return (
    <DefinitionForm
      definition={null}
      targets={definitions.map((d) => ({ id: d.id, name: d.name }))}
    />
  )
}
