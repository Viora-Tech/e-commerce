import { loadEnv } from '@commerce/config'
import { notFound, redirect } from 'next/navigation'
import PageForm from '@/components/online-store/page-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { customizeHref } from '@/lib/customize-href'

export default async function PageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const [page, themes] = await Promise.all([
    call(appRouter.pages.get, { id }, { context }).catch(() => undefined),
    call(appRouter.themes.list, undefined, { context }).catch(() => []),
  ])

  if (page === undefined) redirect('/select-store')
  if (!page) notFound()
  const live = themes.find((t) => t.role === 'main')
  const templates = live
    ? await call(appRouter.themes.templates.list, { themeId: live.id }, { context }).catch(() => [])
    : []
  return (
    <PageForm
      page={page}
      suffixes={templates.filter((t) => t.template === 'page' && t.suffix).map((t) => t.suffix)}
      contentHref={customizeHref(live?.id ?? null, page)}
      storefrontOrigin={loadEnv(process.env).STOREFRONT_URL}
    />
  )
}
