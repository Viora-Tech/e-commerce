'use client'

import { Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type DragEvent, useRef, useState } from 'react'
import { purchaseDocumentsContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'

type DocumentDropProps = {
  onFiles: (files: File[]) => void
  uploading: boolean
  disabled?: boolean | undefined
}

const ACCEPT = 'application/pdf,image/jpeg,image/png'

const filesFrom = (list: FileList | null): File[] => (list ? Array.from(list) : [])

/** Drop target for bills: PDF, JPG or PNG, click to choose. */
export default function DocumentDrop({ onFiles, uploading, disabled }: DocumentDropProps) {
  // Hooks
  const { drop: copy } = useCopy(purchaseDocumentsContent)
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
  const label = uploading ? copy.uploading : over ? copy.active : copy.idle

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
          'flex h-full min-h-20 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-4 text-center',
          'text-muted-foreground transition-[border-color,background-color,color] duration-150 ease-out',
          'hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-ring',
          over && 'border-primary bg-primary-soft/60 text-foreground',
          disabled && 'opacity-60',
        )}
      >
        <Upload className="size-4" aria-hidden />
        <span className="text-body-strong">{label}</span>
        <span className="text-caption">{copy.hint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={handleChange}
        className="sr-only"
        tabIndex={-1}
      />
    </>
  )
}
