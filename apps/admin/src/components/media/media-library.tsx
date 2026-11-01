'use client'

import { siteConfig } from '@commerce/config/site'
import { Database, LayoutGrid, ListView, Search, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { type FormEvent, Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTablePagination from '@/components/table/resource-table/pagination'
import ViewSelect from '@/components/table/view-select'
import { imageEditorContent } from '@/data/image-editor'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { isEditableImage } from '@/lib/image-edit'
import { routes } from '@/lib/routes'
import AltTextDialog from './alt-text-dialog'
import BackgroundWorkNotice from './background-work-notice'
import { displayName, FILE_TABS, type FileTab, fileKind, formatBytes } from './file-meta'
import ImageEditorDialog from './image-editor-dialog'
import MediaDropzone from './media-dropzone'
import MediaFileRows from './media-file-rows'
import MediaFolderBar from './media-folder-bar'
import MediaTile, { type MediaTileAction } from './media-tile'
import MoveToFolderDialog from './move-to-folder-dialog'
import { useMediaFolders } from './use-media-folders'
import { useUploadQueue } from './use-upload-queue'

type ListResult = Awaited<ReturnType<typeof api.media.list>>
type Item = ListResult['items'][number]

const VIEWS = ['grid', 'list'] as const

/** A `?folder=` value that can name a folder; anything else lists every file. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** How often the page re-reads while a file on it is still being optimised. */
const OPTIMISING_POLL_MS = 5_000

export type FileCounts = { all: number; image: number; video: number; document: number }

export type MediaLibraryInitial = {
  page: number
  perPage: number
  query: string
  type: FileTab | null
  /** The folder being browsed (#91); null is every file. */
  folder: string | null
  result: ListResult
  counts: FileCounts
  /** Bytes the store's ready files take, for the summary line. */
  usedBytes: number
}

async function fetchCounts(): Promise<{ counts: FileCounts; usedBytes: number }> {
  const usage = await api.media.usage()
  return {
    counts: {
      all: usage.files,
      image: usage.image.files,
      video: usage.video.files,
      document: usage.document.files,
    },
    usedBytes: usage.totalBytes,
  }
}

function fetchMedia(
  page: number,
  perPage: number,
  query: string,
  type: FileTab | null,
  folder: string | null,
) {
  return api.media.list({
    page,
    perPage,
    search: query || undefined,
    fileType: type ?? undefined,
    folderId: folder && UUID.test(folder) ? folder : undefined,
  })
}

function MediaLibraryContent({ initial }: { initial: MediaLibraryInitial }) {
  // Hooks
  const { library: copy } = useCopy(mediaContent)
  const { title: editImageLabel } = useCopy(imageEditorContent)
  const fileInput = useRef<HTMLInputElement>(null)
  const [{ page, perPage, query, type, view, folder }, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      type: parseAsStringLiteral(FILE_TABS),
      view: parseAsStringLiteral(VIEWS).withDefault('grid'),
      folder: parseAsString,
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>(initial.result.items)
  const [total, setTotal] = useState(initial.result.total)
  const [counts, setCounts] = useState(initial.counts)
  const [usedBytes, setUsedBytes] = useState(initial.usedBytes)
  const [editing, setEditing] = useState<Item | null>(null)
  const [retouching, setRetouching] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [moving, setMoving] = useState<Item | null>(null)
  const { folders, reload: reloadFolders } = useMediaFolders()
  const [draft, setDraft] = useState(initial.query)
  const queue = useUploadQueue(async (done) => {
    setQ({ page: 1 })
    /* Uploaded while a folder is open: it goes in that folder, so it stays in view. */
    if (folder) {
      await api.media.moveToFolder({ ids: [done.id], folderId: folder }).catch(() => undefined)
      reloadFolders()
    }
    fetchMedia(1, perPage, query, type, folder).then((r) => {
      setItems(r.items)
      setTotal(r.total)
    })
    fetchCounts().then((r) => {
      setCounts(r.counts)
      setUsedBytes(r.usedBytes)
    })
  })
  useEffect(() => {
    const sameAsServer =
      page === initial.page &&
      perPage === initial.perPage &&
      query === initial.query &&
      type === initial.type &&
      folder === initial.folder
    if (sameAsServer) return
    let cancelled = false
    fetchMedia(page, perPage, query, type, folder).then((r) => {
      if (cancelled) return
      setItems(r.items)
      setTotal(r.total)
    })
    return () => {
      cancelled = true
    }
  }, [
    page,
    perPage,
    query,
    type,
    folder,
    initial.page,
    initial.perPage,
    initial.query,
    initial.type,
    initial.folder,
  ])
  /* A fresh image shows at once marked "Optimising"; re-read the page until the worker is done,
     so its tile switches to the small optimised copy without a reload (each read re-arms this). */
  useEffect(() => {
    if (!items.some((i) => i.status === 'processing')) return
    const timer = setTimeout(() => {
      fetchMedia(page, perPage, query, type, folder)
        .then((r) => {
          setItems(r.items)
          setTotal(r.total)
        })
        .catch(() => {})
    }, OPTIMISING_POLL_MS)
    return () => clearTimeout(timer)
  }, [items, page, perPage, query, type, folder])

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
  /** An edited copy lands at the top of the first page, like any new upload. */
  const handleRetouched = () => {
    setQ({ page: 1 })
    fetchMedia(1, perPage, query, type, folder).then((r) => {
      setItems(r.items)
      setTotal(r.total)
    })
    fetchCounts().then((r) => {
      setCounts(r.counts)
      setUsedBytes(r.usedBytes)
    })
  }
  const handleAltSaved = (id: string, alt: string | null) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, alt } : i)))
  /** Moved out of the folder on screen: it leaves the page; otherwise it just changes folder. */
  const handleMoved = (id: string, folderId: string | null) => {
    if (folder && folderId !== folder) {
      setItems((list) => list.filter((i) => i.id !== id))
      setTotal((n) => Math.max(0, n - 1))
    } else {
      setItems((list) => list.map((i) => (i.id === id ? { ...i, folderId } : i)))
    }
    reloadFolders()
  }
  const handleDeleted = (id: string) => {
    setItems((list) => list.filter((i) => i.id !== id))
    setTotal((n) => Math.max(0, n - 1))
    fetchCounts().then((r) => {
      setCounts(r.counts)
      setUsedBytes(r.usedBytes)
    })
    reloadFolders()
    toast.success(mediaContent.toasts.deleted)
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.media.delete({ id: deleting.id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : mediaContent.errors.generic)
      throw err
    }
    handleDeleted(deleting.id)
  }

  const actionsFor = (item: Item): MediaTileAction[] => [
    { label: mediaContent.tile.editAlt, onSelect: () => setEditing(item) },
    { label: mediaContent.tile.moveToFolder, onSelect: () => setMoving(item) },
    ...(isEditableImage(item.contentType)
      ? [{ label: editImageLabel, onSelect: () => setRetouching(item) }]
      : []),
    { label: mediaContent.tile.delete, onSelect: () => setDeleting(item), destructive: true },
  ]
  /** The file's page carries the search and type, so its arrows step through this same list. */
  const fileHref = (id: string) => routes.content.file(id, { query, type })
  const metaOf = (item: Item) =>
    [item.size ? formatBytes(item.size) : fileKind(item.contentType), copy.used(item.usedBy)]
      .filter(Boolean)
      .join(' · ')

  // Render logic
  const empty = items.length === 0 && queue.pending.length === 0 && !query && !type && !folder
  /* Inside a folder the store-wide counts would mislead: All counts the folder, types go blank. */
  const openFolder = folder ? folders.find((f) => f.id === folder) : undefined
  const typeCounts = folder ? null : counts

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(counts.all, formatBytes(usedBytes))}
      actions={
        <>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.content.storage()} />}
          >
            <Database aria-hidden="true" />
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
      <BackgroundWorkNotice />
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
          <MediaFolderBar
            folders={folders}
            active={folder}
            total={counts.all}
            onSelect={(next) => setQ({ folder: next, page: 1 })}
            onChanged={reloadFolders}
          />
          <div className="overflow-hidden rounded-2xl border surface-card">
            {/* Figma Files (647:1251): the table toolbar, the grid and the pager in one card. */}
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2">
              <ViewSelect
                value={type}
                onChange={(next) => setQ({ type: next, page: 1 })}
                options={[
                  {
                    value: null,
                    label: copy.tabs.all,
                    count: folder ? openFolder?.files : counts.all,
                  },
                  { value: 'image', label: copy.tabs.image, count: typeCounts?.image },
                  { value: 'video', label: copy.tabs.video, count: typeCounts?.video },
                  {
                    value: 'document',
                    label: copy.tabs.document,
                    count: typeCounts?.document,
                  },
                ]}
              />
              <span aria-hidden="true" className="h-5 w-px bg-line" />
              <form onSubmit={handleSearch} className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-0.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={copy.search}
                  className="border-0 bg-transparent pl-7 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  aria-label={copy.search}
                />
              </form>
              <ToggleGroup
                value={[view]}
                onValueChange={(v) => {
                  const next = VIEWS.find((x) => x === v[0])
                  if (next) setQ({ view: next })
                }}
                variant="outline"
                spacing={0}
              >
                <ToggleGroupItem value="grid" aria-label={copy.view.grid} title={copy.view.grid}>
                  <LayoutGrid aria-hidden />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label={copy.view.list} title={copy.view.list}>
                  <ListView aria-hidden />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            {view === 'list' ? (
              <MediaFileRows
                pending={queue.pending}
                onAltSaved={handleAltSaved}
                rows={items.map((item) => ({
                  id: item.id,
                  url: item.url,
                  alt: item.alt,
                  contentType: item.contentType,
                  variants: item.variants,
                  name: displayName(item) || copy.title,
                  meta: metaOf(item),
                  actions: actionsFor(item),
                  href: fileHref(item.id),
                }))}
              />
            ) : (
              <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
                {queue.pending.map((p) => (
                  <li
                    key={p.key}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted"
                  >
                    {p.file.type.startsWith('video/') ? (
                      <video
                        src={p.previewUrl}
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-cover opacity-50"
                      />
                    ) : (
                      /* biome-ignore lint/performance/noImgElement: object URL preview while uploading. */
                      <img
                        src={p.previewUrl}
                        alt=""
                        className="size-full object-cover opacity-50"
                      />
                    )}
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
                    caption={displayName(item) || undefined}
                    meta={metaOf(item)}
                    actions={actionsFor(item)}
                    href={fileHref(item.id)}
                  />
                ))}
              </ul>
            )}
            {items.length === 0 && queue.pending.length === 0 ? (
              <EmptyState
                variant="plain"
                size="lg"
                body={folder && !query && !type ? copy.emptyFolder : copy.noMatch}
              />
            ) : null}
            {total > 0 ? (
              <ResourceTablePagination
                page={page}
                perPage={perPage}
                total={total}
                onPageChange={(p) => setQ({ page: p })}
                onPerPageChange={(n) => setQ({ perPage: n, page: 1 })}
              />
            ) : null}
          </div>
        </>
      )}
      <AltTextDialog
        key={`alt-${editing?.id ?? 'none'}`}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={handleAltSaved}
      />
      <ImageEditorDialog
        key={`edit-${retouching?.id ?? 'none'}`}
        item={retouching}
        mode="copy"
        onClose={() => setRetouching(null)}
        onSaved={handleRetouched}
      />
      {moving ? (
        <MoveToFolderDialog
          key={moving.id}
          file={{ id: moving.id, name: displayName(moving), folderId: moving.folderId }}
          folders={folders}
          onClose={() => setMoving(null)}
          onMoved={handleMoved}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={copy.deleteTitle}
          body={copy.deleteBody(deleting.usedBy)}
          confirmLabel={copy.deleteConfirm}
          cancelLabel={copy.cancel}
          onConfirm={handleDelete}
        />
      ) : null}
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
