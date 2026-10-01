'use client'

import { RETURN_PHOTO_MAX_BYTES } from '@commerce/storage/keys'
import { useState } from 'react'
import { returnsContent } from '@/data/returns'
import { uploadReturnPhotoAction } from '@/lib/return-actions'

type ReturnPhotosProps = {
  photos: string[]
  onChange: (next: string[]) => void
  disabled: boolean
}

const copy = returnsContent.form
const MAX_PHOTOS = 3
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Up to three photos, each uploaded as soon as it is picked. */
export default function ReturnPhotos({ photos, onChange, disabled }: ReturnPhotosProps) {
  // Hooks
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (photos.length >= MAX_PHOTOS) return setError(copy.errors.photoLimit)
    if (!TYPES.includes(file.type)) return setError(copy.errors.photoType)
    if (file.size > RETURN_PHOTO_MAX_BYTES) return setError(copy.errors.photoSize)
    setUploading(true)
    try {
      const form = new FormData()
      form.set('photo', file)
      const r = await uploadReturnPhotoAction(form)
      if (r.ok) onChange([...photos, r.url])
      else setError(r.error)
    } catch {
      setError(copy.errors.photoFailed)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (url: string) => onChange(photos.filter((p) => p !== url))

  // Render logic
  const canAdd = photos.length < MAX_PHOTOS && !disabled && !uploading

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="h4 mb-1">{copy.photosHeading}</legend>
      <p className="text-small text-muted">{copy.photosHelp}</p>
      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {photos.map((url) => (
            <li
              key={url}
              className="relative size-20 overflow-hidden rounded-xl border border-line"
            >
              {/* biome-ignore lint/performance/noImgElement: the shopper's own upload on the store's storage. */}
              <img src={url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(url)}
                disabled={disabled}
                aria-label={copy.removePhoto}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-ink text-small text-surface"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd || uploading ? (
        <label
          className={`btn btn--secondary self-start${uploading ? ' is-loading' : ''}`}
          aria-disabled={!canAdd}
        >
          <span className="btn__label">{uploading ? copy.uploading : copy.addPhoto}</span>
          <input
            type="file"
            accept={TYPES.join(',')}
            className="sr-only"
            onChange={handlePick}
            disabled={!canAdd}
          />
        </label>
      ) : null}
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
