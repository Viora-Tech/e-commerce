'use client'

import { ImageIcon, Plus, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type Announcements, closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'
import { AnimatePresence, motion } from 'motion/react'
import { type DragEvent, useId, useRef, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import AltTextDialog from '@/components/media/alt-text-dialog'
import ImageDragOverlay from '@/components/media/image-drag-overlay'
import ImageEditorDialog from '@/components/media/image-editor-dialog'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import type { MediaTileItem } from '@/components/media/media-tile'
import { useUploadQueue } from '@/components/media/use-upload-queue'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { IMAGE_ENTER_MS, inOrder, useImageDnd, useLiveOrder } from '@/hooks/use-image-dnd'
import { isEditableImage } from '@/lib/image-edit'
import ProductImagePending from './product-image-pending'
import ProductImageTile, { imageName } from './product-image-tile'

type ProductImageCardProps = {
  items: MediaTileItem[]
  /** Functional update so parallel uploads never clobber each other. */
  onChange: (update: (prev: MediaTileItem[]) => MediaTileItem[]) => void
  /** Uploads are in flight, so saving is blocked upstream. */
  onUploading?: ((busy: boolean) => void) | undefined
}

const ACCEPT = 'image/*,video/mp4'

/* dnd-kit moves nothing itself: the card reorders its preview live and Motion glides the tiles. */
const holdStill: SortingStrategy = () => null

/** A drag from the desktop (files), not a tile being sorted (dnd-kit uses pointer events). */
function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

/**
 * The product gallery after the Saleor Dashboard product media card (BSD-3): the main image
 * spans two by two, the rest are square tiles, the last tile adds more. Tiles sort by drag
 * (mouse, touch or keyboard) and the order is the form's `media` order, which the product
 * save stores as each image's position; files dropped on the card upload into it.
 */
export default function ProductImageCard({ items, onChange, onUploading }: ProductImageCardProps) {
  // Hooks
  const { media: copy } = useCopy(productFormContent)
  const { reduced, sensors, dropAnimation } = useImageDnd()
  /* dnd-kit numbers its aria ids per render tree; a React id keeps server and client equal. */
  const dndId = useId()
  /* Set while a Replace upload runs, so its result becomes the main image again. */
  const replacing = useRef(false)
  const queue = useUploadQueue((done) => {
    const front = replacing.current
    replacing.current = false
    onChange((prev) => (front ? [done, ...prev] : [...prev, done]))
  })
  const [editing, setEditing] = useState<MediaTileItem | null>(null)
  const [retouching, setRetouching] = useState<MediaTileItem | null>(null)
  const [picking, setPicking] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const replaceRef = useRef<HTMLInputElement>(null)
  /* While a tile is carried the others glide to where it would land. */
  const { shown, active, handlers } = useLiveOrder(items, (ids) =>
    onChange((prev) => inOrder(prev, ids)),
  )

  // Helpers
  const nameOf = (id: unknown) => {
    const item = items.find((i) => i.id === id)
    return item ? imageName(item) : ''
  }

  const positionOf = (id: unknown) => shown.findIndex((i) => i.id === id) + 1

  const upload = (files: File[]) => {
    if (!files.length) return
    onUploading?.(true)
    void queue.start(files).finally(() => onUploading?.(false))
  }

  // Event handlers
  const handleReplace = (files: FileList | null) => {
    const list = files ? Array.from(files).slice(0, 1) : []
    if (!list.length) return
    replacing.current = true
    onChange((prev) => prev.slice(1))
    upload(list)
  }

  const handleRemove = (item: MediaTileItem) =>
    onChange((prev) => prev.filter((i) => i.id !== item.id))

  /** The edited copy takes the original's place, so the order (and main image) stays. */
  const handleRetouched = (original: MediaTileItem, edited: MediaTileItem) =>
    onChange((prev) => prev.map((i) => (i.id === original.id ? edited : i)))

  const handleAltSaved = (id: string, alt: string | null) =>
    onChange((prev) => prev.map((i) => (i.id === id ? { ...i, alt } : i)))

  /** Appends library picks after what's already here, keeping the order they were picked in. */
  const handlePickMany = (picked: PickedMedia[]) => {
    setPicking(false)
    if (picked.length === 0) return
    onChange((prev) => [...prev, ...picked.filter((p) => !prev.some((i) => i.id === p.id))])
  }

  const handleFileDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(e)) return
    e.preventDefault()
    setFileOver(true)
  }

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(e)) return
    e.preventDefault()
    setFileOver(false)
    upload(Array.from(e.dataTransfer.files))
  }

  // Render logic
  const total = items.length
  const pending = queue.pending
  const announcements: Announcements = {
    onDragStart: (e) => copy.sort.picked(nameOf(e.active.id)),
    onDragOver: (e) =>
      e.over ? copy.sort.moved(nameOf(e.active.id), positionOf(e.over.id), total) : '',
    onDragEnd: (e) =>
      e.over ? copy.sort.dropped(nameOf(e.active.id), positionOf(e.over.id), total) : '',
    onDragCancel: (e) => copy.sort.cancelled(nameOf(e.active.id)),
  }

  return (
    <DataCard
      title={copy.heading}
      action={
        <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
          <ImageIcon aria-hidden="true" />
          {copy.browse}
        </Button>
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: file drop target only; Add image and Browse are the accessible routes. */}
      <div
        onDragOver={handleFileDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false)
        }}
        onDrop={handleFileDrop}
        className="relative flex flex-col gap-3"
      >
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: copy.sort.instructions },
          }}
          {...handlers}
        >
          <SortableContext items={shown.map((i) => i.id)} strategy={holdStill}>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {items.length === 0 ? (
                <li className="col-span-2 row-span-2 aspect-square">
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="flex size-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-4 text-center text-body text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ImageIcon className="size-6" aria-hidden="true" />
                    {copy.empty}
                  </button>
                </li>
              ) : null}
              {shown.map((item, index) => (
                <ProductImageTile
                  key={item.id}
                  item={item}
                  main={index === 0}
                  reduced={reduced}
                  onEdit={() => setEditing(item)}
                  onEditImage={
                    isEditableImage(item.contentType) ? () => setRetouching(item) : undefined
                  }
                  onRemove={() => handleRemove(item)}
                  onReplace={() => replaceRef.current?.click()}
                />
              ))}
              {pending.map((p) => (
                <ProductImagePending
                  key={p.key}
                  upload={p}
                  onRetry={() => queue.retry(p.key)}
                  onDismiss={() => queue.dismiss(p.key)}
                />
              ))}
              <li className="aspect-square">
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  className="flex size-full flex-col items-center justify-center gap-1 rounded-lg border border-border-strong border-dashed text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <Plus className="size-5" aria-hidden="true" />
                  <span className="text-caption">{copy.add}</span>
                </button>
              </li>
            </ul>
          </SortableContext>
          <ImageDragOverlay reduced={reduced} dropAnimation={dropAnimation}>
            {active ? (
              // biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts.
              <img
                src={active.url}
                alt=""
                draggable={false}
                className="size-full bg-muted/40 object-cover"
              />
            ) : null}
          </ImageDragOverlay>
        </DndContext>

        {total > 1 ? (
          <p className="text-caption text-muted-foreground">{copy.reorderHint}</p>
        ) : null}

        <AnimatePresence>
          {fileOver ? (
            <motion.div
              aria-hidden="true"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: IMAGE_ENTER_MS / 1000, ease: [0.25, 1, 0.5, 1] }}
              className="pointer-events-none absolute -inset-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-primary border-dashed bg-primary-soft/85 text-body font-medium text-foreground backdrop-blur-[2px]"
            >
              <Upload className="size-5" />
              {copy.dropToUpload}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          handleReplace(e.target.files)
          e.target.value = ''
        }}
      />
      <AltTextDialog
        key={editing?.id ?? 'none'}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={handleAltSaved}
      />
      <ImageEditorDialog
        key={retouching?.id ?? 'none'}
        item={retouching}
        onClose={() => setRetouching(null)}
        onSaved={handleRetouched}
      />
      <MediaPickDialog
        open={picking}
        multiple
        onClose={() => setPicking(false)}
        onPickMany={handlePickMany}
      />
    </DataCard>
  )
}
