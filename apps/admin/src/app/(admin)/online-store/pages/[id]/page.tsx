import { loadEnv } from '@commerce/config'
import { parseTheme, themeToCss } from '@commerce/core'
import { notFound, redirect } from 'next/navigation'
import { PageEditor } from '@/components/online-store/page-editor'
import { appRouter, call, serverContext } from '@/lib/api'

export default async function PageEditorRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const [page, store] = await Promise.all([
    call(appRouter.pages.get, { id }, { context }).catch(() => undefined),
    call(appRouter.store.current, undefined, { context }).catch(() => null),
  ])
  if (page === undefined || !store) redirect('/select-store')
  if (!page) notFound()
  return (
    <PageEditor
      page={page}
      themeCss={themeToCss(parseTheme(store.theme))}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
    />
  )
}
