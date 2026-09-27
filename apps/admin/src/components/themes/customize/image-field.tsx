'use client'

import type { FocalPoint } from '@commerce/blocks/media'
import { ImagePlus, MoreHorizontal, RotateCcw, Trash2, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Input } from '@commerce/ui/shadcn/input'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type DragEvent, useId, useState } from 'react'
import { toast } from 'sonner'
import MediaPickDialog, { type PickedMedia } from '@/components/media/media-pick-dialog'
import type { MediaVariants } from '@/components/media/media-pick-types'
import { customizeContent } from '@/data/customize'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import { rejectReason, uploadFile } from '@/lib/upload'
import ImageFocalPreview from './image-focal-preview'

/**
 * A section image as stored in the theme doc: `{ url, alt, focal? }`
 * (`focal` documented in packages/blocks/src/focal-point.ts). Any other keys
 * already on the value are kept as they are.
 */
type ImageValue = { url?: string; alt?: string; focal?: FocalPoint } & Record<string, unknown>

type ImageFieldProps = {
  value: unknown
  onChange: (value: unknown) => void
}

type Preview = { variants: MediaVariants | null; thumbhash: string | null }

const copy = customizeContent.image

const NO_PREVIEW: Preview = { variants: null, thumbhash: null }

const asImage = (value: unknown) => (value ?? {}) as ImageValue

/** The value with a new picture: the old focal point belonged to the old picture, so it goes. */
function withPicture(image: ImageValue, url: string, alt: string | null): ImageValue {
  const { focal: _drop, ...rest } = image
  return { ...rest, url, alt: image.alt || alt || '' }
}

/**
 * Shopify's image setting: a large preview you can drop a file onto, Select
 * for the media library, alt text under it, a focal point set by clicking the
 * picture, and Replace / Remove in the "more" menu.
 */
export default function ImageField({ value, onChange }: ImageFieldProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [picking, setPicking] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<Preview>(NO_PREVIEW)
  const altId = useId()

  // Helpers
  const set = (next: ImageValue) => onChange(next)

  // Event handlers
  const handlePick = (media: PickedMedia | null) => {
    setPicking(false)
    if (!media) return
    setPreview({ variants: media.variants ?? null, thumbhash: media.thumbhash ?? null })
    set(withPicture(asImage(value), media.url, media.alt))
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'))
    if (!file || progress !== null) return
    const reason = rejectReason(file)
    if (reason) {
      toast.error(reason)
      return
    }
    setProgress(0)
    try {
      const done = await uploadFile(file, setProgress)
      setPreview(NO_PREVIEW)
      set(withPicture(asImage(value), done.url, done.alt))
    } catch {
      toast.error(copy.uploadFailed)
    } finally {
      setProgress(null)
    }
  }

  const handleRemove = () => {
    const { focal: _drop, ...rest } = asImage(value)
    setPreview(NO_PREVIEW)
    set({ ...rest, url: '' })
  }

  const handleResetFocal = () => {
    const { focal: _drop, ...rest } = asImage(value)
    set(rest)
  }

  // Render logic
  const image = asImage(value)
  const hasImage = Boolean(image.url)
  const uploading = progress !== null

  return (
    <div className="flex flex-col gap-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target only; Select is the keyboard path. */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex min-h-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border bg-muted/60 p-2 transition-colors duration-150 motion-reduce:transition-none',
          dragOver ? 'border-primary bg-primary-soft' : 'border-border',
          !hasImage && 'border-dashed',
        )}
      >
        {hasImage && image.url ? (
          <ImageFocalPreview
            url={image.url}
            alt={image.alt ?? ''}
            focal={image.focal}
            variants={preview.variants}
            thumbhash={preview.thumbhash}
            onFocal={(focal) => set({ ...image, focal })}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 py-4 text-center">
            <span className="flex size-9 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-card">
              <ImagePlus aria-hidden className="size-4" />
            </span>
            <p className="text-[0.8125rem] font-medium text-foreground">{copy.drop}</p>
            <p className="text-xs text-muted-foreground">{copy.dropHint}</p>
          </div>
        )}
        <AnimatePresence>
          {uploading || dragOver ? (
            <motion.div
              key="state"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.15 }}
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/85 backdrop-blur-sm"
            >
              <Upload aria-hidden className="size-4 text-primary" />
              <span className="text-xs font-medium" aria-live="polite">
                {uploading ? copy.uploading(Math.round((progress ?? 0) * 100)) : copy.drop}
              </span>
              {uploading ? (
                <span className="h-1 w-2/3 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-150"
                    style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                  />
                </span>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={uploading}
          onClick={() => setPicking(true)}
        >
          {hasImage ? copy.change : copy.select}
        </Button>
        {hasImage ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={copy.more}
                  title={copy.more}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={() => setPicking(true)}>
                <ImagePlus aria-hidden />
                {copy.replace}
              </DropdownMenuItem>
              {image.focal ? (
                <DropdownMenuItem onClick={handleResetFocal}>
                  <RotateCcw aria-hidden />
                  {copy.focalReset}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleRemove}>
                <Trash2 aria-hidden />
                {copy.remove}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {hasImage ? <p className="text-xs text-muted-foreground">{copy.focalHint}</p> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={altId} className="text-xs font-medium text-muted-foreground">
          {copy.alt}
        </label>
        <Input
          id={altId}
          value={image.alt ?? ''}
          onChange={(e) => set({ ...image, alt: e.target.value })}
          placeholder={copy.altPlaceholder}
          aria-describedby={`${altId}-hint`}
          size="lg"
          className={FIELD_CONTROL}
        />
        <p id={`${altId}-hint`} className="text-xs text-muted-foreground">
          {copy.altHint}
        </p>
      </div>
      <MediaPickDialog
        open={picking}
        title={copy.dialog}
        onClose={() => setPicking(false)}
        onPick={handlePick}
      />
    </div>
  )
}
