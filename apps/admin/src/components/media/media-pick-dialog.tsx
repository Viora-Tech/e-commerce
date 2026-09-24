'use client'

import { Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'
import { rejectReason } from '@/lib/upload'
import MediaPickDropzone from './media-pick-dropzone'
import MediaPickGrid from './media-pick-grid'
import MediaPickToolbar, {
  type MediaFileTypeFilter,
  type MediaSizeFilter,
  type MediaSortKey,
  type MediaUsedFilter,
  type MediaViewMode,
} from './media-pick-toolbar'
import { type MediaItem, matchesMediaQuery, type PickedMedia } from './media-pick-types'
import { useUploadQueue } from './use-upload-queue'

export type { MediaItem, PickedMedia } from './media-pick-types'

type MediaPickDialogProps = {
  open: boolean
  /** Defaults to "Select file"; callers still pass a task-specific title. */
  title?: string
  /** Shown when the library has no images yet. */
  empty?: string
  /** Multiple files can be selected, in pick order. Defaults to single-select. */
  multiple?: boolean
  /**
   * Restrict the picker to a fixed, already-loaded list (e.g. a product's own
   * gallery for the variant picker) instead of browsing the whole store library.
   * Disables upload, sort and the filter chips.
   */
  items?: MediaItem[]
  onClose: () => void
  /** Single-select result; called with `null` only when the caller wants that convention. */
  onPick?: (media: PickedMedia | null) => void
  /** Multi-select result, in the order items were picked. */
  onPickMany?: (media: PickedMedia[]) => void
}

const copy = mediaContent.picker
const PER_PAGE = 42

type FetchArgs = {
  page: number
  query: string
  sort: MediaSortKey
  fileType: MediaFileTypeFilter
  size: MediaSizeFilter
  used: MediaUsedFilter
}

/** Pure wrapper around `api.media.list` so it can sit above the component, clear of hook-ordering rules. */
function fetchMediaPage(args: FetchArgs) {
  return api.media.list({
    page: args.page,
    perPage: PER_PAGE,
    search: args.query.trim() || undefined,
    sort: args.sort,
    fileType: args.fileType === 'all' ? undefined : args.fileType,
    size: args.size === 'all' ? undefined : args.size,
    used: args.used === 'all' ? undefined : args.used,
  })
}

/**
 * Shopify-style "Select file" dialog: search, sort, filter chips, an upload
 * dropzone, an infinite-scrolling grid or list, and single- or multi-select.
 * Shared by every image field in admin and by the Puck editor.
 */
export default function MediaPickDialog({
  open,
  title,
  empty,
  multiple,
  items: fixedItems,
  onClose,
  onPick,
  onPickMany,
}: MediaPickDialogProps) {
  // Hooks
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<MediaSortKey>('newest')
  const [fileType, setFileType] = useState<MediaFileTypeFilter>('all')
  const [sizeFilter, setSizeFilter] = useState<MediaSizeFilter>('all')
  const [used, setUsed] = useState<MediaUsedFilter>('all')
  const [view, setView] = useState<MediaViewMode>('grid')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [urlBusy, setUrlBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const queue = useUploadQueue((done) => {
    const item: MediaItem = {
      id: done.id,
      url: done.url,
      alt: done.alt,
      key: null,
      contentType: done.contentType,
      size: null,
      usedBy: 0,
    }
    setItems((list) => [item, ...list])
    setTotal((n) => n + 1)
    setSelectedIds((ids) => (multiple ? [...ids, item.id] : [item.id]))
  })

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedIds([])
      setUrlOpen(false)
      setUrlValue('')
      return
    }
    if (fixedItems !== undefined) return
    const handle = setTimeout(
      () => {
        setLoading(true)
        fetchMediaPage({ page: 1, query, sort, fileType, size: sizeFilter, used })
          .then((r) => {
            setItems(r.items)
            setTotal(r.total)
            setPage(1)
          })
          .finally(() => setLoading(false))
      },
      query ? 250 : 0,
    )
    return () => clearTimeout(handle)
  }, [open, fixedItems, query, sort, fileType, sizeFilter, used])

  useEffect(() => {
    if (!open || fixedItems !== undefined) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const hasMore = items.length < total
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !hasMore || loading || loadingMore) return
        const nextPage = page + 1
        setLoadingMore(true)
        fetchMediaPage({ page: nextPage, query, sort, fileType, size: sizeFilter, used })
          .then((r) => {
            setItems((list) => [...list, ...r.items])
            setTotal(r.total)
            setPage(nextPage)
          })
          .finally(() => setLoadingMore(false))
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [
    open,
    fixedItems,
    items.length,
    total,
    loading,
    loadingMore,
    page,
    query,
    sort,
    fileType,
    sizeFilter,
    used,
  ])

  // Event handlers
  const handleUploadFiles = (files: File[]) => void queue.start(files)
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleUploadFiles(Array.from(e.target.files ?? []))
    if (e.target) e.target.value = ''
  }
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    handleUploadFiles(Array.from(e.dataTransfer.files))
  }
  const handleUrlAdd = async () => {
    const url = urlValue.trim()
    if (!url) return
    setUrlBusy(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const name = url.split('/').pop()?.split('?')[0] || 'image'
      const file = new File([blob], name, { type: blob.type })
      const reason = rejectReason(file)
      if (reason) {
        toast.error(reason)
        return
      }
      handleUploadFiles([file])
      setUrlValue('')
      setUrlOpen(false)
    } catch {
      toast.error(copy.fromUrlFailed)
    } finally {
      setUrlBusy(false)
    }
  }
  const handleToggle = (id: string) => {
    setSelectedIds((ids) => {
      if (!multiple) return ids.includes(id) ? [] : [id]
      return ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
    })
  }
  const handleConfirmOne = (id: string) => {
    const list = fixedItems ?? items
    const found = list.find((i) => i.id === id)
    if (found) {
      onPick?.({ id: found.id, url: found.url, alt: found.alt, contentType: found.contentType })
    }
  }
  const handleDone = () => {
    const list = fixedItems ?? items
    const picked = selectedIds
      .map((id) => list.find((i) => i.id === id))
      .filter((i): i is MediaItem => Boolean(i))
      .map((i) => ({ id: i.id, url: i.url, alt: i.alt, contentType: i.contentType }))
    if (multiple) {
      onPickMany?.(picked)
      return
    }
    onPick?.(picked[0] ?? null)
  }
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  // Render logic
  const restricted = fixedItems !== undefined
  const needle = query.trim().toLowerCase()
  const results = restricted ? fixedItems.filter((i) => matchesMediaQuery(i, needle)) : items
  const showEmpty = !loading && results.length === 0 && queue.pending.length === 0
  const doneDisabled = selectedIds.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[64rem] flex-col gap-0 p-0">
        <DialogHeader className="gap-3 border-b p-4">
          <DialogTitle className="text-base font-medium">{title ?? copy.title}</DialogTitle>
          <MediaPickToolbar
            restricted={restricted}
            query={query}
            sort={sort}
            fileType={fileType}
            size={sizeFilter}
            used={used}
            view={view}
            onQuery={setQuery}
            onSort={setSort}
            onFileType={setFileType}
            onSize={setSizeFilter}
            onUsed={setUsed}
            onView={setView}
          />
        </DialogHeader>

        {!restricted ? (
          <MediaPickDropzone
            inputRef={inputRef}
            dragOver={dragOver}
            uploadDisabled={queue.pending.length > 0}
            urlOpen={urlOpen}
            urlValue={urlValue}
            urlBusy={urlBusy}
            onDragOver={() => setDragOver(true)}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onFileInput={handleFileInput}
            onToggleUrl={() => setUrlOpen((v) => !v)}
            onUrlValueChange={setUrlValue}
            onUrlAdd={handleUrlAdd}
          />
        ) : null}

        <div className="min-h-[20rem] flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span className="sr-only">{copy.loading}</span>
            </div>
          ) : null}
          {showEmpty ? (
            <div className="flex h-64 flex-col items-center justify-center gap-1 text-center">
              <p className="text-body-strong">
                {query || !restricted ? copy.noResults : (empty ?? copy.empty)}
              </p>
            </div>
          ) : null}
          {!loading && (results.length > 0 || queue.pending.length > 0) ? (
            <MediaPickGrid
              view={view}
              pending={queue.pending}
              results={results}
              selectedIds={selectedIds}
              multiple={Boolean(multiple)}
              onToggle={handleToggle}
              onConfirm={handleConfirmOne}
            />
          ) : null}
          {!restricted ? <div ref={sentinelRef} className="h-1" /> : null}
          {loadingMore ? (
            <div className="flex justify-center py-3 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-between">
          <span className="text-caption text-muted-foreground" aria-live="polite">
            {selectedIds.length > 0 ? copy.selectedCount(selectedIds.length) : null}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="button" disabled={doneDisabled} onClick={handleDone}>
              {copy.done}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
