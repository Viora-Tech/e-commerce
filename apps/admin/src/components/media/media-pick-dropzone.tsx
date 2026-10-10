'use client'

import { ImagePlus, LinkIcon, Loader2Icon, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import type { ChangeEvent, RefObject } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'

type MediaPickDropzoneProps = {
  inputRef: RefObject<HTMLInputElement | null>
  /** Files are being dragged over the dialog (the whole body is the drop target). */
  dragOver: boolean
  urlOpen: boolean
  urlValue: string
  urlBusy: boolean
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void
  onToggleUrl: () => void
  onUrlValueChange: (value: string) => void
  onUrlAdd: () => void
}

/**
 * The upload well at the top of the picker, drawn like the theme editor's image field
 * (#194): a glyph in a lifted square, what to drop and what is accepted, then the two ways
 * in without dropping: Upload files and From URL (which opens an address row below).
 */
export default function MediaPickDropzone({
  inputRef,
  dragOver,
  urlOpen,
  urlValue,
  urlBusy,
  onFileInput,
  onToggleUrl,
  onUrlValueChange,
  onUrlAdd,
}: MediaPickDropzoneProps) {
  // Hooks
  const { picker: copy } = useCopy(mediaContent)

  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border border-border-strong border-dashed bg-muted/40 px-4 py-5 text-center transition-colors duration-150 motion-reduce:transition-none sm:flex-row sm:text-left',
          dragOver && 'border-primary bg-primary-soft/60',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-muted-foreground shadow-card">
          {dragOver ? (
            <Upload aria-hidden="true" className="size-4 text-primary" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-strong text-foreground">
            {dragOver ? copy.dropActive : copy.dropTitle}
          </span>
          <span className="text-caption text-muted-foreground">{copy.dropTypes}</span>
        </span>
        <span className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" />
            {copy.uploadFiles}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={urlOpen}
            onClick={onToggleUrl}
          >
            <LinkIcon aria-hidden="true" />
            {copy.fromUrl}
          </Button>
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={mediaContent.accept}
          onChange={onFileInput}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
      {urlOpen ? (
        /* Not a <form>: React carries submit through the portal to any form around the
           page that opened the picker. */
        <div className="flex items-center gap-2">
          <Input
            type="url"
            value={urlValue}
            onChange={(e) => onUrlValueChange(e.target.value)}
            placeholder={copy.fromUrlPlaceholder}
            aria-label={copy.fromUrl}
            className="min-w-0 flex-1"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              onUrlAdd()
            }}
            autoFocus
          />
          <Button type="button" size="sm" disabled={urlBusy || !urlValue.trim()} onClick={onUrlAdd}>
            {urlBusy ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {urlBusy ? copy.fromUrlBusy : copy.fromUrlAdd}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
