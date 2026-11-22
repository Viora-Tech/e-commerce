'use client'

import type { IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type DragEvent, useRef, useState } from 'react'

type FileDropzoneProps = {
  onFiles: (files: File[]) => void
  /** The file input's `accept` ("application/pdf,image/png"). */
  accept: string
  /** What the box says: idle, while files are dragged over it, and while they upload. */
  copy: { idle: string; active: string; hint?: string | undefined; uploading?: string | undefined }
  icon: IconComponent
  /** Files are uploading: the box says so and is busy. */
  uploading?: boolean | undefined
  disabled?: boolean | undefined
  /** A small strip (under an existing grid) instead of the tall target; the hint is left out. */
  compact?: boolean | undefined
  className?: string | undefined
}

const filesFrom = (list: FileList | null): File[] => (list ? Array.from(list) : [])

/**
 * The one drop target for files (owner, 22 Nov 2026: media library, bills): drop files on it or
 * click to choose. A button with a hidden file input, so it is reachable by keyboard.
 */
export default function FileDropzone({
  onFiles,
  accept,
  copy,
  icon: Icon,
  uploading = false,
  disabled,
  compact,
  className,
}: FileDropzoneProps) {
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
    if (!disabled) onFiles(filesFrom(e.dataTransfer.files))
  }
  const handleChange = () => {
    onFiles(filesFrom(inputRef.current?.files ?? null))
    if (inputRef.current) inputRef.current.value = ''
  }

  // Render logic
  const label = uploading && copy.uploading ? copy.uploading : over ? copy.active : copy.idle

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled}
        aria-busy={uploading || undefined}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 text-center',
          'text-muted-foreground transition-[border-color,background-color,color] duration-150 ease-out',
          'hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-ring',
          over && 'border-primary bg-primary-soft/60 text-foreground',
          compact ? 'py-3' : 'py-6',
          disabled && 'opacity-60',
          className,
        )}
      >
        <Icon className={compact ? 'size-4' : 'size-5'} aria-hidden />
        <span className="text-body-strong">{label}</span>
        {compact || !copy.hint ? null : <span className="text-caption">{copy.hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  )
}
