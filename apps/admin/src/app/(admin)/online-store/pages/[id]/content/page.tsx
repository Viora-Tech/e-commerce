import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { appRouter, call, serverContext } from '@/lib/api'
import { customizeHref } from '@/lib/customize-href'

export const metadata: Metadata = { title: 'Page' }

/** The old standalone page builder's address now opens the page's template in Customize. */
export default async function PageContentRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const context = await serverContext()
  const [page, themes] = await Promise.all([
    call(appRouter.pages.get, { id }, { context }).catch(() => null),
    call(appRouter.themes.list, undefined, { context }).catch(() => []),
  ])
  if (!page) notFound()
  redirect(customizeHref(themes.find((t) => t.role === 'main')?.id ?? null, page))
}
