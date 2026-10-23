'use client'

import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'

type AvatarCropDialogProps = {
  /** The photo the member picked; null keeps the dialog closed. */
  file: File | null
  busy: boolean
  onCancel: () => void
  /** The square crop as a data URL (WebP, or JPEG where the browser cannot write WebP). */
  onCrop: (dataUrl: string) => void
}

type Offset = { x: number; y: number }

/** Edge of the square the browser sends; the server re-encodes it to 256 px. */
const OUTPUT_SIZE = 512
const MAX_ZOOM = 3
const KEY_STEP = 0.02

/** Image size relative to the square viewport at `zoom` (1 = the short edge fills it). */
function coverSize(img: HTMLImageElement, zoom: number) {
  const short = Math.min(img.naturalWidth, img.naturalHeight)
  return { w: (img.naturalWidth / short) * zoom, h: (img.naturalHeight / short) * zoom }
}

/** Keeps the photo covering the whole square: an offset never shows an empty edge. */
function clampOffset(img: HTMLImageElement, zoom: number, offset: Offset): Offset {
  const size = coverSize(img, zoom)
  const maxX = (size.w - 1) / 2
  const maxY = (size.h - 1) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
  }
}

/** Draws the visible square at OUTPUT_SIZE and encodes it, WebP first, JPEG as the fallback. */
function cropToDataUrl(img: HTMLImageElement, zoom: number, offset: Offset): string {
  const side = Math.min(img.naturalWidth, img.naturalHeight) / zoom
  const cx = img.naturalWidth / 2 - offset.x * side
  const cy = img.naturalHeight / 2 - offset.y * side
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  const webp = canvas.toDataURL('image/webp', 0.9)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.9)
}

/**
 * Square crop for a profile photo: drag to move, slider (or + and −) to zoom, arrow keys to
 * nudge. Shows the round shape the photo takes everywhere else in the admin.
 */
export default function AvatarCropDialog({ file, busy, onCancel, onCrop }: AvatarCropDialogProps) {
  // Hooks
  const {
    profile: { crop: copy },
  } = useCopy(accountContent)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const viewRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ x: number; y: number; start: Offset } | null>(null)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setImage(img)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    img.src = url
    return () => {
      URL.revokeObjectURL(url)
      setImage(null)
    }
  }, [file])

  // Helpers
  const move = (next: Offset, atZoom = zoom) => {
    if (image) setOffset(clampOffset(image, atZoom, next))
  }

  // Event handlers
  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, start: offset }
  }

  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const view = viewRef.current?.clientWidth
    if (!drag || !view) return
    move({
      x: drag.start.x + (e.clientX - drag.x) / view,
      y: drag.start.y + (e.clientY - drag.y) / view,
    })
  }

  const handlePointerUp = () => {
    dragRef.current = null
  }

  const handleZoom = (next: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(1, next))
    setZoom(z)
    move(offset, z)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, Offset> = {
      ArrowLeft: { x: offset.x - KEY_STEP, y: offset.y },
      ArrowRight: { x: offset.x + KEY_STEP, y: offset.y },
      ArrowUp: { x: offset.x, y: offset.y - KEY_STEP },
      ArrowDown: { x: offset.x, y: offset.y + KEY_STEP },
    }
    const next = moves[e.key]
    if (next) {
      e.preventDefault()
      move(next)
    } else if (e.key === '+' || e.key === '=') {
      handleZoom(zoom + 0.1)
    } else if (e.key === '-') {
      handleZoom(zoom - 0.1)
    }
  }

  const handleSave = () => {
    if (image) onCrop(cropToDataUrl(image, zoom, offset))
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !busy) onCancel()
  }

  // Render logic
  const size = image ? coverSize(image, zoom) : { w: 1, h: 1 }

  return (
    <Dialog open={file !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <button
          type="button"
          ref={viewRef}
          aria-label={copy.title}
          aria-description={copy.body}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={handleKeyDown}
          className="relative mx-auto aspect-square w-full max-w-[18rem] cursor-grab touch-none overflow-hidden rounded-lg bg-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        >
          {image ? (
            // biome-ignore lint/performance/noImgElement: a local object URL being cropped, never optimised.
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: `${size.w * 100}%`,
                height: `${size.h * 100}%`,
                left: `${50 + offset.x * 100}%`,
                top: `${50 + offset.y * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ) : null}
          {/* The round shape the photo takes in the admin; the corners show what is cut. */}
          <span className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_100rem_color-mix(in_oklch,var(--background)_60%,transparent)] ring-2 ring-background/80" />
        </button>
        <label className="flex items-center gap-3 text-body text-muted-foreground">
          <span className="shrink-0">{copy.zoom}</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            disabled={!image}
            className="w-full cursor-pointer accent-primary"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!image} loading={busy}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
