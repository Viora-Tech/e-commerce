'use client'

import { type ChangeEvent, useRef, useState } from 'react'
import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import Icon from '../icon'

export type UploadedPhoto = { token: string; url: string }

type ReviewPhotoInputProps = {
  photos: UploadedPhoto[]
  max: number
  onChange: (photos: UploadedPhoto[]) => void
  onError: (message: string) => void
  /** Where a photo is posted (`/reviews/photo`); the store comes from the hostname. */
  endpoint: string
}

const ACCEPT = 'image/jpeg,image/png,image/webp'
/** Phone photos are shrunk in the browser first: quicker on mobile data, under the upload cap. */
const LONG_EDGE = 2000

/** A JPEG no longer than LONG_EDGE on its long side; the original when the browser cannot decode it. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    return blob ?? file
  } catch {
    return file
  }
}

/** "Add up to 5 photos": each picked photo is shrunk, uploaded, and shown as a removable tile. */
export default function ReviewPhotoInput({
  photos,
  max,
  onChange,
  onError,
  endpoint,
}: ReviewPhotoInputProps) {
  // Hooks
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)

  // Helpers
  const upload = async (file: File): Promise<UploadedPhoto | null> => {
    const blob = await shrink(file)
    const body = new FormData()
    body.set('photo', blob, file.name.replace(/\.[^.]+$/, '') || 'photo')
    const res = await fetch(endpoint, { method: 'POST', body })
    const data = (await res.json().catch(() => null)) as
      | { ok: true; token: string; url: string }
      | { ok: false; error?: string }
      | null
    return data?.ok ? { token: data.token, url: data.url } : null
  }

  // Event handlers
  const handlePick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].slice(0, max - photos.length)
    event.target.value = ''
    if (files.length === 0) return
    setUploading(files.length)
    const added: UploadedPhoto[] = []
    for (const file of files) {
      const done = await upload(file).catch(() => null)
      if (done) added.push(done)
      else onError(copy.form.errors.photo)
      setUploading((n) => n - 1)
    }
    onChange([...photos, ...added].slice(0, max))
  }

  // Render logic
  const room = photos.length + uploading < max

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{copy.form.photos}</span>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={handlePick}
      />
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <span
            key={p.token}
            className="relative size-16 overflow-hidden rounded-md border border-line"
          >
            <img src={p.url} alt="" className="size-full object-cover" />
            <button
              type="button"
              aria-label={copy.form.removePhoto}
              onClick={() => onChange(photos.filter((x) => x.token !== p.token))}
              className="absolute top-0.5 right-0.5 flex size-6 touch-manipulation items-center justify-center rounded-full bg-bg/90! text-ink"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders for uploads in flight, never reordered.
            key={i}
            className="flex size-16 animate-pulse items-center justify-center rounded-md border border-line bg-surface text-xs text-muted"
          >
            {copy.form.uploading}
          </span>
        ))}
      </div>
      {room ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex min-h-14 w-full touch-manipulation items-center justify-center rounded-md border! border-dashed! border-line! text-sm text-muted transition-colors hover:text-ink"
        >
          {copy.form.addPhotos(max)}
        </button>
      ) : null}
    </div>
  )
}
