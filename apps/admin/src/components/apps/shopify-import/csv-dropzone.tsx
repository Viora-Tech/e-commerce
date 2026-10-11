'use client'

import { Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useRef, useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'

type CsvDropzoneProps = {
  file: File | null
  error: 'notCsv' | 'tooBig' | null
  onFile: (file: File | null) => void
}

/** Drag-and-drop box (also a button that opens the file picker) for the Shopify CSV. */
export default function CsvDropzone({ file, error, onFile }: CsvDropzoneProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.csv)
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  // Event handlers
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(true)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    onFile(event.dataTransfer.files[0] ?? null)
  }

  // Render logic
  const title = dragging ? copy.dropActive : file ? file.name : copy.dropTitle
  const line = dragging
    ? null
    : file
      ? `${copy.size(file.size)}. ${copy.dropReplace}`
      : copy.dropBrowse

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center outline-none transition-colors duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/40 motion-reduce:transition-none',
          dragging || file
            ? 'border-primary bg-primary-soft'
            : 'border-border-strong bg-muted/40 hover:bg-muted/70',
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <span className="max-w-full truncate text-body-strong text-ink-strong">{title}</span>
        {line ? <span className="text-body text-muted-foreground">{line}</span> : null}
        <span className="text-caption text-muted-foreground">{copy.maxSize}</span>
      </button>
      {error ? <p className="text-body text-destructive">{copy[error]}</p> : null}
    </div>
  )
}
