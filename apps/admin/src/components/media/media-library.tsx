'use client'

import { siteConfig } from '@commerce/config/site'
import { Search, Settings, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { type FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTablePagination from '@/components/table/resource-table/pagination'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AltTextDialog from './alt-text-dialog'
import DeleteMediaDialog from './delete-media-dialog'
import { FILE_TABS, type FileTab, fileKind, fileName, formatBytes } from './file-meta'
import MediaDropzone from './media-dropzone'
import MediaTile from './media-tile'
import { useUploadQueue } from './use-upload-queue'

type ListResult = Awaited<ReturnType<typeof api.media.list>>
type Item = ListResult['items'][number]

export type FileCounts = { all: number; image: number; video: number }

export type MediaLibraryInitial = {
  page: number
  perPage: number
  query: string
  type: FileTab | null
  result: ListResult
  counts: FileCounts
}

async function fetchCounts(): Promise<FileCounts> {
  const [all, image, video] = await Promise.all([
    api.media.list({ page: 1, perPage: 1 }),
    api.media.list({ page: 1, perPage: 1, fileType: 'image' }),
    api.media.list({ page: 1, perPage: 1, fileType: 'video' }),
  ])
  return { all: all.total, image: image.total, video: video.total }
}

function fetchMedia(page: number, perPage: number, query: string, type: FileTab | null) {
  return api.media.list({
    page,
    perPage,
    search: query || undefined,
    fileType: type ?? undefined,
  })
}

function MediaLibraryContent({ initial }: { initial: MediaLibraryInitial }) {
  // Hooks
  const { library: copy } = useCopy(mediaContent)
  const fileInput = useRef<HTMLInputElement>(null)
  const [{ page, perPage, query, type }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      type: parseAsStringLiteral(FILE_TABS),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [counts, setCounts] = useState(initial.counts)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [draft, setDraft] = useState(initial.query)
  const queue = useUploadQueue(() => {
    setQ({ page: 1 })
    fetchMedia(1, perPage, query, type).then((r) => {
      setItems(r.items)
      setTotal(r.total)
    })
    fetchCounts().then(setCounts)
  })
  useEffect(() => {
    const sameAsServer =
      page === initial.page &&
      perPage === initial.perPage &&
      query === initial.query &&
      type === initial.type
    if (sameAsServer) return
    let cancelled = false
    fetchMedia(page, perPage, query, type).then((r) => {
      if (cancelled) return
      setItems(r.items)
      setTotal(r.total)
    })
    return () => {
      cancelled = true
    }
  }, [page, perPage, query, type, initial.page, initial.perPage, initial.query, initial.type])

  // Event handlers
  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setQ({ query: draft.trim(), page: 1 })
  }
  const handleFiles = (files: File[]) => void queue.start(files)
  const handlePicked = () => {
    handleFiles(Array.from(fileInput.current?.files ?? []))
    if (fileInput.current) fileInput.current.value = ''
  }
  const handleAltSaved = (id: string, alt: string | null) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, alt } : i)))
  const handleDeleted = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    fetchCounts().then(setCounts)
    toast.success(mediaContent.toasts.deleted)
  }

  // Render logic
  const empty = items.length === 0 && queue.pending.length === 0 && !query && !type

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(counts.all)}
      actions={
        <>
          <Button
            variant="key-neutral"
            nativeButton={false}
            render={<Link href={routes.content.storage()} />}
          >
            <Settings aria-hidden="true" />
            {copy.storage}
          </Button>
          <Button type="button" onClick={() => fileInput.current?.click()}>
            <Upload aria-hidden="true" />
            {copy.upload}
          </Button>
        </>
      }
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={mediaContent.accept}
        onChange={handlePicked}
        className="sr-only"
        tabIndex={-1}
        aria-label={copy.upload}
      />
      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border surface-card px-4 py-12 text-center">
          <p className="text-body-strong">{copy.empty.heading}</p>
          <p className="max-w-md text-body text-muted-foreground">{copy.empty.body}</p>
          <div className="mt-2 w-full max-w-md">
            <MediaDropzone onFiles={handleFiles} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PillTabs
              value={type}
              onChange={(next) => setQ({ type: next, page: 1 })}
              tabs={[
                { value: null, label: copy.tabs.all, count: counts.all },
                { value: 'image', label: copy.tabs.image, count: counts.image },
                { value: 'video', label: copy.tabs.video, count: counts.video },
              ]}
            />
            <form onSubmit={handleSearch} className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={copy.search}
                className="pl-8"
                aria-label={copy.search}
              />
            </form>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {queue.pending.map((p) => (
              <li
                key={p.key}
                className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
              >
                {/* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */}
                <img src={p.previewUrl} alt="" className="size-full object-cover opacity-50" />
                <span className="absolute inset-x-0 bottom-0 bg-card/90 px-2 py-1 text-center text-caption">
                  {p.error
                    ? mediaContent.tile.failed
                    : mediaContent.tile.uploading(Math.round(p.progress * 100))}
                </span>
              </li>
            ))}
            {items.map((item) => (
              <MediaTile
                key={item.id}
                item={item}
                wide
                caption={item.key ? fileName(item.key) : undefined}
                meta={[fileKind(item.contentType), item.size ? formatBytes(item.size) : '']
                  .filter(Boolean)
                  .join(' · ')}
                actions={[
                  { label: mediaContent.tile.editAlt, onSelect: () => setEditing(item) },
                  {
                    label: mediaContent.tile.delete,
                    onSelect: () => setDeleting(item),
                    destructive: true,
                  },
                ]}
              />
            ))}
          </ul>
          {items.length === 0 && queue.pending.length === 0 ? (
            <p className="py-10 text-center text-body text-muted-foreground">{copy.noMatch}</p>
          ) : null}
          {total > 0 ? (
            <div className="overflow-hidden rounded-2xl border surface-card">
              <ResourceTablePagination
                page={page}
                perPage={perPage}
                total={total}
                onPageChange={(p) => setQ({ page: p })}
                onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
              />
            </div>
          ) : null}
        </>
      )}
      <AltTextDialog
        key={editing?.id ?? 'none'}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={handleAltSaved}
      />
      <DeleteMediaDialog
        item={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={handleDeleted}
      />
    </ProoflyListPage>
  )
}

export default function MediaLibrary({ initial }: { initial: MediaLibraryInitial }) {
  return (
    <Suspense>
      <MediaLibraryContent initial={initial} />
    </Suspense>
  )
}
