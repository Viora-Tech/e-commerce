'use client'

import { Search } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs'
import { type FormEvent, Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import ResourceTablePagination from '@/components/table/resource-table/pagination'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'
import AltTextDialog from './alt-text-dialog'
import DeleteMediaDialog from './delete-media-dialog'
import MediaDropzone from './media-dropzone'
import MediaTile from './media-tile'
import { useUploadQueue } from './use-upload-queue'

type ListResult = Awaited<ReturnType<typeof api.media.list>>
type Item = ListResult['items'][number]

export type MediaLibraryInitial = { page: number; query: string; result: ListResult }

const PER_PAGE = 40
const copy = mediaContent.library

function fetchMedia(page: number, query: string) {
  return api.media.list({ page, perPage: PER_PAGE, search: query || undefined })
}

function MediaLibraryContent({ initial }: { initial: MediaLibraryInitial }) {
  // Hooks
  const [{ page, query }, setQ] = useQueryStates(
    { query: parseAsString.withDefault(''), page: parseAsInteger.withDefault(1) },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [draft, setDraft] = useState(initial.query)
  const queue = useUploadQueue(() => {
    setQ({ page: 1 })
    fetchMedia(1, query).then((r) => {
      setItems(r.items)
      setTotal(r.total)
    })
  })
  useEffect(() => {
    if (page === initial.page && query === initial.query) return
    let cancelled = false
    fetchMedia(page, query).then((r) => {
      if (cancelled) return
      setItems(r.items)
      setTotal(r.total)
    })
    return () => {
      cancelled = true
    }
  }, [page, query, initial.page, initial.query])

  // Event handlers
  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    setQ({ query: draft.trim(), page: 1 })
  }
  const handleFiles = (files: File[]) => void queue.start(files)
  const handleAltSaved = (id: string, alt: string | null) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, alt } : i)))
  const handleDeleted = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    toast.success(mediaContent.toasts.deleted)
  }

  // Render logic
  const empty = items.length === 0 && queue.pending.length === 0 && !query

  return (
    <PageBody className="gap-6">
      <div className="flex h-9 items-center justify-between">
        <h1 className="text-page-title">{copy.title}</h1>
      </div>
      <Card className="gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="w-64">
            <MediaDropzone onFiles={handleFiles} compact />
          </div>
        </div>
        {empty ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-body-strong">{copy.empty.heading}</p>
            <p className="max-w-md text-body text-muted-foreground">{copy.empty.body}</p>
            <div className="mt-2 w-full max-w-md">
              <MediaDropzone onFiles={handleFiles} />
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {queue.pending.map((p) => (
              <li
                key={p.key}
                className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
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
                caption={copy.used(item.usedBy)}
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
        )}
        {total > PER_PAGE ? (
          <ResourceTablePagination
            page={page}
            perPage={PER_PAGE}
            total={total}
            onPageChange={(p) => setQ({ page: p })}
          />
        ) : null}
      </Card>
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
    </PageBody>
  )
}

export default function MediaLibrary({ initial }: { initial: MediaLibraryInitial }) {
  return (
    <Suspense>
      <MediaLibraryContent initial={initial} />
    </Suspense>
  )
}
