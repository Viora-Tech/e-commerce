import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { FILE_TABS, type FileTab } from '@/components/media/file-meta'
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
  const rawPer = Number.parseInt(first(sp.perPage) ?? '', 10)
  const options: readonly number[] = siteConfig.ui.rowsPerPage.options
  const perPage = options.includes(rawPer) ? rawPer : siteConfig.ui.rowsPerPage.default
  const query = first(sp.query) ?? ''
  const rawType = first(sp.type)
  const type: FileTab | null = FILE_TABS.find((t) => t === rawType) ?? null
  const context = await serverContext()
  const [result, all, image, video] = await Promise.all([
    call(
      appRouter.media.list,
      { page, perPage, search: query || undefined, fileType: type ?? undefined },
      { context },
    ),
    call(appRouter.media.list, { page: 1, perPage: 1 }, { context }),
    call(appRouter.media.list, { page: 1, perPage: 1, fileType: 'image' }, { context }),
    call(appRouter.media.list, { page: 1, perPage: 1, fileType: 'video' }, { context }),
  ])
  return (
    <MediaLibrary
      initial={{
        page,
        perPage,
        query,
        type,
        result,
        counts: { all: all.total, image: image.total, video: video.total },
      }}
    />
  )
}
