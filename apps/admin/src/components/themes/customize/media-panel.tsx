'use client'

import { Search, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { MediaItem } from '@/components/media/media-pick-types'
import MediaThumb from '@/components/media/media-thumb'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import type { CustomizeDoc } from '@/lib/customize-doc'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import { sectionName } from '@/lib/customize-insert'
import { type FieldShape, MEDIA_DRAG_TYPE, mediaAction } from '@/lib/customize-media-insert'
import { useCustomizePuck } from '@/lib/customize-puck'
import { rejectReason, uploadFile } from '@/lib/upload'

const PAGE = 40

/**
 * The Media rail panel: the store's pictures with a search and an upload button. Click a
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
  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reason = rejectReason(file)
    if (reason) {
      toast.error(reason)
      return
    }
    setUploading(true)
    try {
      await uploadFile(file, () => {})
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

  // Render logic
  const list = items ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPages(1)
            }}
            placeholder={copy.search}
            aria-label={copy.search}
            size="lg"
            className={cn(FIELD_CONTROL, 'pl-8')}
          />
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          className="size-8 shrink-0 rounded-lg"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          aria-label={uploading ? copy.uploading : copy.upload}
          title={uploading ? copy.uploading : copy.upload}
        >
          <Upload aria-hidden className={cn('size-3.5', uploading && 'animate-pulse')} />
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={handleUpload}
        />
      </div>
      {items !== null && list.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="text-[0.8125rem] font-medium text-foreground">
            {query ? copy.noMatch : copy.empty}
          </p>
          {query ? null : <p className="text-xs text-muted-foreground">{copy.emptyHint}</p>}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {list.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => handleUse(item)}
                aria-label={copy.use(item.alt || copy.picture)}
                title={item.alt ?? undefined}
                className={cn(
                  'block aspect-square w-full cursor-grab overflow-hidden rounded-lg border border-border bg-muted transition-[border-color,box-shadow] duration-150 hover:border-primary active:cursor-grabbing motion-reduce:transition-none',
                  CHROME_FOCUS,
                )}
              >
                <MediaThumb item={item} className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.length < total ? (
        <Button variant="ghost" size="sm" onClick={() => setPages((p) => p + 1)}>
          {copy.more}
        </Button>
      ) : null}
    </div>
  )
}
