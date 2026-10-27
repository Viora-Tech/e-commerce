'use client'

import { CheckIcon, ImageIcon, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react'
import { useUploadQueue } from '@/components/media/use-upload-queue'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { MediaItem } from './form-state'
import ProductImagePending from './product-image-pending'
import VariantImageChosenTile from './variant-image-chosen-tile'
import { chosenItems, isVariantImage, moveId, toggleId } from './variant-images'

type VariantImagesDialogProps = {
  open: boolean
  /** The variant's title ("Black"), for the dialog title. */
  label: string
  /** The product's gallery, in order. */
  media: MediaItem[]
  /** The variant's images when the dialog opened; the draft starts from these. */
  value: string[]
  onClose: () => void
  /** Uploaded files join the product gallery straight away, whatever happens to the draft. */
  onAddMedia: (items: MediaItem[]) => void
  onSave: (mediaIds: string[]) => void
}

const ACCEPT = 'image/*'

/** A drag from the desktop (files), not text or a link. */
function carriesFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files')
}

/**
 * Choose a variant's images: several product photos in order (the first is the variant's main
 * image), moved earlier or later and removed, plus Upload and drag-and-drop, which go through
 * the same upload pipeline as the product gallery and land in it as well.
 */
export default function VariantImagesDialog({
  open,
  label,
  media,
  value,
  onClose,
  onAddMedia,
  onSave,
}: VariantImagesDialogProps) {
  // Hooks
  const { variantImages: copy } = useCopy(productFormContent)
  const [draft, setDraft] = useState<string[]>(value)
  const [fileOver, setFileOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const queue = useUploadQueue((done) => {
    onAddMedia([{ id: done.id, url: done.url, alt: done.alt, contentType: done.contentType }])
    setDraft((ids) => (ids.includes(done.id) ? ids : [...ids, done.id]))
  })

  // Event handlers
  const handleFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'))
    if (images.length) void queue.start(images)
  }

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(e)) return
    e.preventDefault()
    setFileOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!carriesFiles(e)) return
    e.preventDefault()
    setFileOver(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  // Render logic
  const photos = media.filter(isVariantImage)
  const chosen = chosenItems(draft, photos)
  const pending = queue.pending
  const uploading = pending.some((p) => !p.error)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90svh,48rem)] w-full flex-col gap-0 p-0 sm:max-w-[48rem]">
        <DialogHeader className="gap-1 border-b p-4">
          <DialogTitle className="text-base font-medium">{copy.title(label)}</DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </DialogHeader>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: file drop target only; the Upload button is the accessible route. */}
        <div
          className="relative flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <section aria-label={copy.chosen} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-body-strong">{copy.chosen}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Upload aria-hidden="true" />
                {copy.upload}
              </Button>
            </div>
            {chosen.length === 0 && pending.length === 0 ? (
              <p className="rounded-lg border border-border-strong border-dashed px-4 py-6 text-center text-body text-muted-foreground">
                {copy.chosenEmpty}
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {chosen.map((item, index) => (
                  <VariantImageChosenTile
                    key={item.id}
                    item={item}
                    index={index}
                    total={chosen.length}
                    onMove={(step) =>
                      setDraft(
                        moveId(
                          chosen.map((c) => c.id),
                          index,
                          step,
                        ),
                      )
                    }
                    onRemove={() => setDraft((ids) => ids.filter((id) => id !== item.id))}
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
              </ul>
            )}
            <p className="text-caption text-muted-foreground">{copy.uploadHint}</p>
          </section>

          <section aria-label={copy.productPhotos} className="flex flex-col gap-2">
            <h3 className="text-body-strong">{copy.productPhotos}</h3>
            {photos.length === 0 ? (
              <p className="text-body text-muted-foreground">{copy.productPhotosEmpty}</p>
            ) : (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {photos.map((item, i) => {
                  const place = draft.indexOf(item.id)
                  const name = item.alt || copy.imageName(i + 1)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={place >= 0}
                        aria-label={copy.toggle(name)}
                        onClick={() => setDraft((ids) => toggleId(ids, item.id))}
                        className={cn(
                          'relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted motion-press',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          place >= 0
                            ? 'border-primary ring-2 ring-primary'
                            : 'border-border hover:border-foreground',
                        )}
                      >
                        {/* biome-ignore lint/performance/noImgElement: media comes from arbitrary storage hosts. */}
                        <img src={item.url} alt="" className="size-full object-cover" />
                        {place >= 0 ? (
                          <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-caption font-medium text-primary-foreground tabular-nums">
                            {place + 1}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {fileOver ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-2 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-primary border-dashed bg-primary-soft/85 text-body font-medium text-foreground"
            >
              <ImageIcon className="size-5" />
              {copy.dropToUpload}
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-between">
          <span className="text-caption text-muted-foreground" aria-live="polite">
            {uploading ? copy.uploading(pending.length) : copy.count(chosen.length)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button
              type="button"
              disabled={uploading}
              onClick={() => onSave(chosen.map((c) => c.id))}
            >
              <CheckIcon aria-hidden="true" />
              {copy.done}
            </Button>
          </div>
        </DialogFooter>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={handleInput}
        />
      </DialogContent>
    </Dialog>
  )
}
