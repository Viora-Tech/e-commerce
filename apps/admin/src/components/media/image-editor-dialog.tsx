'use client'

import { AiIcon, RefreshCw, RotateCcw, Save } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import type { MediaTileItem } from '@/components/media/media-tile'
import { imageEditorContent } from '@/data/image-editor'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  adjustFilter,
  autoAdjust,
  type ImageAdjust,
  type ImageEdit,
  loadEditableImage,
  NO_ADJUST,
  renderEditedImage,
} from '@/lib/image-edit'
import { type UploadedMedia, uploadFile } from '@/lib/upload'
import ImageAdjustSliders from './image-adjust-sliders'

type ImageEditorDialogProps = {
  /** The photo being edited, or null when the editor is closed. */
  item: MediaTileItem | null
  onClose: () => void
  /** The edited copy, uploaded and carrying the original's alt text. */
  onSaved: (original: MediaTileItem, edited: UploadedMedia) => void
  /** `copy`: the edit is kept beside the original (the media library) instead of replacing it. */
  mode?: 'replace' | 'copy' | undefined
}

type Shape = 'free' | 'square' | 'portrait' | 'tall' | 'wide'

const SHAPES: readonly Shape[] = ['free', 'square', 'portrait', 'tall', 'wide']
const RATIO: Record<Exclude<Shape, 'free'>, number> = {
  square: 1,
  portrait: 4 / 5,
  tall: 3 / 4,
  wide: 16 / 9,
}

const turn = (r: ImageEdit['rotation'], by: 90 | -90): ImageEdit['rotation'] =>
  ((((r + by) % 360) + 360) % 360) as ImageEdit['rotation']

/**
 * Edit a stored photo in the browser: crop to a shape (react-easy-crop, MIT), rotate, flip and
 * adjust, with a live preview. Save draws the result on a canvas, uploads it as a new photo
 * (the pipeline makes its sizes) and hands it back to replace the original where it was used.
 */
export default function ImageEditorDialog({
  item,
  onClose,
  onSaved,
  mode = 'replace',
}: ImageEditorDialogProps) {
  // Hooks
  const copy = useCopy(imageEditorContent)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [shape, setShape] = useState<Shape>('free')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [rotation, setRotation] = useState<ImageEdit['rotation']>(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [adjust, setAdjust] = useState<ImageAdjust>(NO_ADJUST)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!item) return
    let live = true
    loadEditableImage(item.url)
      .then((loaded) => live && setImg(loaded))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [item])

  // Event handlers
  const handleReset = () => {
    setShape('free')
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setAdjust(NO_ADJUST)
  }

  const handleSave = async () => {
    if (!item || !img || !area) return
    setBusy(true)
    try {
      const name = item.url.split('/').pop()?.split('?')[0] ?? 'image'
      const file = await renderEditedImage(
        img,
        { crop: area, rotation, flipX, flipY, adjust },
        name,
        item.contentType === 'image/png',
      )
      const uploaded = await uploadFile(file, () => {})
      if (item.alt) await api.media.update({ id: uploaded.id, alt: item.alt })
      onSaved(item, { ...uploaded, alt: item.alt })
      toast.success(mode === 'copy' ? copy.savedCopy : copy.saved)
      onClose()
    } catch {
      toast.error(copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const turned = rotation === 90 || rotation === 270
  const naturalAspect = img
    ? turned
      ? img.naturalHeight / img.naturalWidth
      : img.naturalWidth / img.naturalHeight
    : 1
  const aspect = shape === 'free' ? naturalAspect : RATIO[shape]
  const filter = adjustFilter(adjust)

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent size="wide">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
          <div className="flex flex-col gap-3">
            <div className="relative h-[22rem] overflow-hidden rounded-lg bg-muted md:h-[26rem]">
              {failed ? (
                <p className="p-6 text-body text-muted-foreground">{copy.loadFailed}</p>
              ) : !img ? (
                <p className="p-6 text-body text-muted-foreground">{copy.loading}</p>
              ) : (
                <Cropper
                  image={img.src}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setArea(pixels)}
                  transform={`translate(${crop.x}px, ${crop.y}px) rotate(${rotation}deg) scale(${zoom * (flipX ? -1 : 1)}, ${zoom * (flipY ? -1 : 1)})`}
                  style={{ mediaStyle: { filter } }}
                  mediaProps={{ crossOrigin: 'anonymous' }}
                />
              )}
            </div>
            <label className="flex items-center gap-3 text-caption text-muted-foreground">
              {copy.zoom}
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-primary"
              />
            </label>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-body font-semibold text-foreground">{copy.shape.label}</span>
              <div className="flex flex-wrap gap-1.5">
                {SHAPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={shape === s}
                    onClick={() => setShape(s)}
                    className={cn(
                      'h-8 rounded-md border px-2.5 text-caption font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      shape === s
                        ? 'border-border-strong bg-muted text-foreground'
                        : 'border-input bg-card text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {copy.shape[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setRotation(turn(rotation, -90))}>
                <RotateCcw aria-hidden="true" />
                {copy.rotateLeft}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRotation(turn(rotation, 90))}>
                <RefreshCw aria-hidden="true" />
                {copy.rotateRight}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={flipX}
                onClick={() => setFlipX(!flipX)}
              >
                {copy.flipX}
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={flipY}
                onClick={() => setFlipY(!flipY)}
              >
                {copy.flipY}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!img}
              onClick={() => img && setAdjust(autoAdjust(img))}
            >
              <AiIcon aria-hidden="true" />
              {copy.auto}
            </Button>
            <ImageAdjustSliders value={adjust} onChange={setAdjust} disabled={!img} />
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={handleReset} disabled={busy}>
            {copy.reset}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button
              loading={busy}
              onClick={() => void handleSave()}
              disabled={busy || !img || !area}
            >
              <Save aria-hidden="true" />
              {busy ? copy.saving : copy.save}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
