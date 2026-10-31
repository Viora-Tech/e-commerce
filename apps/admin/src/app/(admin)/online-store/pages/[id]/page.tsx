import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import PageForm from '@/components/online-store/page-form'
import { appRouter, call, serverContext } from '@/lib/api'
import { customizeHref } from '@/lib/customize-href'
import { orNoStoreOrMissing } from '@/lib/store-guard'
import { storefrontOrigin } from '@/lib/storefront-origin'

type Params = { params: Promise<{ id: string }> }

type RouteProps = Params & { searchParams: Promise<{ from?: string | string[] }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const found = await call(appRouter.pages.get, { id }, { context }).catch(() => null)
  return { title: found?.title || 'Page' }
}

export default async function PageRoute({ params, searchParams }: RouteProps) {
  const { id } = await params
  const { from } = await searchParams
  const context = await serverContext()
  const [page, themes] = await Promise.all([
    call(appRouter.pages.get, { id }, { context }).catch(orNoStoreOrMissing(undefined)),
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
      storefrontOrigin={await storefrontOrigin()}
      fromSeo={from === 'seo'}
    />
  )
}
