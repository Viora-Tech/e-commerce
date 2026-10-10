'use client'

import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fileName } from '@/components/media/file-meta'
import type { MediaItem } from '@/components/media/media-pick-types'
import MediaThumb from '@/components/media/media-thumb'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { FIELD_INPUT } from '@/lib/customize-field-styles'
import { sectionName } from '@/lib/customize-insert'
import { type FieldShape, MEDIA_DRAG_TYPE, mediaAction } from '@/lib/customize-media-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { rejectReason, uploadFile } from '@/lib/upload'

const PAGE = 40

/**
 * The Media rail panel (Figma 381:6945): a drop zone to upload (drop files or click to browse),
 * a search, the store's pictures as tiles marked Used / Unused on this page with their file
 * names, and a hint at the foot. Click a
 * picture to put it in the selected block's first empty picture setting, or drag it onto a
 * section on the canvas (the drop lands in `preview-frame.tsx`). The same Puck `replace` the
 * inspector's picture setting dispatches, so undo covers it.
 */
export default function MediaPanel() {
  // Hooks
  const copy = useCopy(customizeContent.media)
  const data = useCustomizePuck((s) => s.appState.data as unknown as CustomizeDoc)
  const components = useCustomizePuck((s) => s.config.components)
  const selected = useCustomizePuck((s) => s.selectedItem)
  const dispatch = useCustomizePuck((s) => s.dispatch)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dropping, setDropping] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // The library, filtered by the search after a short pause, then page by page.
  useEffect(() => {
    let live = true
    const timer = window.setTimeout(() => {
      api.media
        .list({
          page: 1,
          perPage: PAGE * pages,
          search: query.trim() || undefined,
          fileType: 'image',
        })
        .then((r) => {
          if (!live) return
          setItems(r.items as MediaItem[])
          setTotal(r.total)
        })
        .catch(() => live && setItems([]))
    }, 200)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [query, pages])

  // Helpers
  const fieldsOf = (type: string) =>
    components[type]?.fields as Record<string, FieldShape> | undefined
  const nameOf = (type: string, props: Record<string, unknown>) =>
    sectionName({ type, props } as never, components[type]?.label ?? type)

  // Event handlers
  const handleUse = (item: MediaItem) => {
    if (!selected) {
      toast.message(copy.selectFirst)
      return
    }
    const name = nameOf(selected.type, selected.props)
    const action = mediaAction(data, fieldsOf, String(selected.props.id), item)
    if (!action) {
      toast.message(copy.noTarget(name))
      return
    }
    dispatch(action)
    toast.success(copy.placed(name))
  }
  const handleDragStart = (e: DragEvent<HTMLButtonElement>, item: MediaItem) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify({ url: item.url, alt: item.alt }))
    e.dataTransfer.setData('text/uri-list', item.url)
  }
  const handleFiles = async (files: File[]) => {
    const ok = files.filter((file) => {
      const reason = rejectReason(file)
      if (reason) toast.error(reason)
      return !reason
    })
    if (ok.length === 0) return
    setUploading(true)
    try {
      for (const file of ok) await uploadFile(file, () => {})
      setPages(1)
      setQuery('')
      const r = await api.media.list({ page: 1, perPage: PAGE, fileType: 'image' })
      setItems(r.items as MediaItem[])
      setTotal(r.total)
    } catch {
      toast.error(copy.uploadFailed)
    } finally {
      setUploading(false)
    }
  }
  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    void handleFiles(files)
  }
  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDropping(true)
  }
  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDropping(false)
    void handleFiles([...e.dataTransfer.files])
  }

  // Render logic
  const list = items ?? []
  // A picture is "Used" when this page already points at its address.
  const page = JSON.stringify(data)

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setDropping(false)}
        onDrop={handleDrop}
        disabled={uploading}
        aria-label={uploading ? copy.uploading : copy.upload}
        className={cn(
          'flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border p-[1.125rem] text-center transition-colors duration-150 hover:border-primary hover:bg-primary-soft/40 disabled:opacity-60 motion-reduce:transition-none',
          dropping && 'border-primary bg-primary-soft',
          CHROME_FOCUS,
        )}
      >
        <Plus
          aria-hidden
          weight="regular"
          className={cn('size-5 text-muted-foreground', uploading && 'animate-pulse')}
        />
        <span className="text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
          {uploading ? copy.uploading : copy.drop}
        </span>
        <span className="text-xs leading-[1.0625rem] text-muted-foreground">{copy.browse}</span>
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={handleUpload}
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setPages(1)
        }}
        placeholder={copy.search}
        aria-label={copy.search}
        className={FIELD_INPUT}
      />
      {items !== null && list.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-[0.8125rem] font-medium text-foreground">
            {query ? copy.noMatch : copy.empty}
          </p>
          {query ? null : <p className="text-xs text-muted-foreground">{copy.emptyHint}</p>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5">
          {list.map((item) => {
            const used = page.includes(item.url)
            const name = fileName(item.key ?? item.url)
            return (
              <li key={item.id} className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleUse(item)}
                  aria-label={copy.use(item.alt || name || copy.picture)}
                  title={item.alt ?? undefined}
                  className={cn(
                    'relative block h-[5.25rem] w-full cursor-grab overflow-hidden rounded-[0.625rem] border border-border bg-muted transition-[border-color,box-shadow] duration-150 hover:border-primary active:cursor-grabbing motion-reduce:transition-none',
                    CHROME_FOCUS,
                  )}
                >
                  <MediaThumb item={item} className="object-cover" />
                  <span
                    title={used ? copy.usedHint : undefined}
                    className={cn(
                      'absolute top-1.5 left-1.5 rounded-full px-1.5 py-0.5 text-xs leading-[1.0625rem] font-medium',
                      used ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {used ? copy.used : copy.unused}
                  </span>
                </button>
                <span className="truncate text-xs leading-[1.0625rem] text-muted-foreground">
                  {name}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {list.length < total ? (
        <Button variant="ghost" size="sm" onClick={() => setPages((p) => p + 1)}>
          {copy.more}
        </Button>
      ) : null}
      <p className="rounded-lg bg-muted p-2.5 text-xs leading-[1.0625rem] text-muted-foreground">
        {copy.hint}
      </p>
    </div>
  )
}
