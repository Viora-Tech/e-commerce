'use client'

import { IMAGE_MAX_UPLOAD_BYTES } from '@commerce/storage/keys'
import { ImagePlus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { type ChangeEvent, useRef, useState } from 'react'
import { toast } from 'sonner'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'
import AvatarCropDialog from './avatar-crop-dialog'
import MemberAvatar from './member-avatar'

type AvatarFieldProps = {
  name: string
  email: string
  image: string | null
  /** Saves the cropped photo; rejects with a message the toast can show. */
  onUpload: (dataUrl: string) => Promise<void>
  onRemove: () => Promise<void>
}

const ACCEPT = 'image/jpeg,image/png,image/webp'

/** Big avatar with Upload / Change and Remove; picking a photo opens the square crop first. */
export default function AvatarField({ name, email, image, onUpload, onRemove }: AvatarFieldProps) {
  // Hooks
  const {
    profile: { photo: copy },
  } = useCopy(accountContent)
  const [picked, setPicked] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Event handlers
  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      toast.error(copy.notImage)
      return
    }
    if (file.size > IMAGE_MAX_UPLOAD_BYTES) {
      toast.error(copy.tooBig)
      return
    }
    setPicked(file)
  }

  const handleCrop = async (dataUrl: string) => {
    setBusy(true)
    try {
      await onUpload(dataUrl)
      setPicked(null)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      await onRemove()
      toast.success(copy.removed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <MemberAvatar
        name={name}
        email={email}
        image={image}
        className="size-20"
        fallbackClassName="bg-avatar text-[1.5rem] text-avatar-foreground"
      />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImagePlus aria-hidden="true" />
            {image ? copy.change : copy.upload}
          </Button>
          {image ? (
            <Button variant="ghost" onClick={handleRemove} disabled={busy}>
              <Trash2 aria-hidden="true" />
              {copy.remove}
            </Button>
          ) : null}
        </div>
        <p className="text-caption text-muted-foreground">{copy.hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePick}
      />
      <AvatarCropDialog
        file={picked}
        busy={busy}
        onCancel={() => setPicked(null)}
        onCrop={handleCrop}
      />
    </div>
  )
}
