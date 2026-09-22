'use client'

import { ImagePlus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type DragEvent, useRef, useState } from 'react'
import { mediaContent } from '@/data/media'

type MediaDropzoneProps = {
  onFiles: (files: File[]) => void
  /** Small strip under an existing grid rather than the big empty-state target. */
  compact?: boolean | undefined
  disabled?: boolean | undefined
}

const copy = mediaContent.dropzone

function filesFrom(list: FileList | null): File[] {
  return list ? Array.from(list) : []
}

export default function MediaDropzone({ onFiles, compact, disabled }: MediaDropzoneProps) {
  // Hooks
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  // Event handlers
  const handleClick = () => {
    if (!disabled) inputRef.current?.click()
  }
  const handleDragOver = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (!disabled) setOver(true)
  }
  const handleDragLeave = () => setOver(false)
  const handleDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    onFiles(filesFrom(e.dataTransfer.files))
  }
  const handleChange = () => {
    onFiles(filesFrom(inputRef.current?.files ?? null))
    if (inputRef.current) inputRef.current.value = ''
  }

  // Render logic
  const label = over ? copy.active : copy.idle

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center transition-colors',
          'text-muted-foreground hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-ring',
          over && 'border-primary bg-primary-soft/60 text-foreground',
          compact ? 'px-4 py-3' : 'px-4 py-8',
          disabled && 'opacity-60',
        )}
      >
        <ImagePlus className={compact ? 'size-4' : 'size-5'} aria-hidden />
        <span className="text-body-strong">{label}</span>
        {compact ? null : <span className="text-caption">{copy.hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={mediaContent.accept}
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  )
}
