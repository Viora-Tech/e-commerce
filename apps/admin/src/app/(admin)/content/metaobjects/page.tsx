import type { Metadata } from 'next'
import DefinitionsPage from '@/components/metaobjects/definitions-page'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getCopy(metaobjectListContent)).heading }
}

export default async function Page() {
  const context = await serverContext()
  const definitions = await call(appRouter.metaobjects.definitions, undefined, { context })
  return <DefinitionsPage definitions={definitions} />
}
