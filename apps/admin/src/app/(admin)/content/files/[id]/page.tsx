import { ORPCError } from '@orpc/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FILE_TABS } from '@/components/media/file-meta'
import MediaFilePage from '@/components/media/media-file-page'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'File' }

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const query = first(sp.query)?.trim() || null
  const rawType = first(sp.type)
  const type = FILE_TABS.find((t) => t === rawType) ?? null
  const context = await serverContext()
  const file = await call(appRouter.media.get, { id }, { context }).catch((err: unknown) => {
    // A missing file, another store's, or an id that is not one at all.
    if (err instanceof ORPCError && (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST'))
      notFound()
    throw err
  })
  const [usedIn, neighbours] = await Promise.all([
    call(appRouter.media.usedIn, { id }, { context }),
    call(
      appRouter.media.neighbours,
      { id, search: query ?? undefined, fileType: type ?? undefined },
      { context },
    ),
  ])
  return (
    <MediaFilePage
      key={id}
      file={file}
      usedIn={usedIn}
      neighbours={neighbours}
      filter={{ query, type }}
    />
  )
}
