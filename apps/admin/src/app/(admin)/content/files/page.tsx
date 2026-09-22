import type { Metadata } from 'next'
import MediaLibrary from '@/components/media/media-library'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'Files' }

type Props = { searchParams: Promise<SearchParams> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const parsed = Number.parseInt(first(sp.page) ?? '', 10)
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  const query = first(sp.query) ?? ''
  const result = await call(
    appRouter.media.list,
    { page, perPage: 40, search: query || undefined },
    { context: await serverContext() },
  )
  return <MediaLibrary initial={{ page, query, result }} />
}
