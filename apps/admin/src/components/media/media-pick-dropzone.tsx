'use client'

import { LinkIcon, Loader2Icon, Plus, Upload } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Input } from '@commerce/ui/shadcn/input'
import type { ChangeEvent, DragEvent, RefObject } from 'react'
import { mediaContent } from '@/data/media'

type MediaPickDropzoneProps = {
  inputRef: RefObject<HTMLInputElement | null>
  dragOver: boolean
  uploadDisabled: boolean
  urlOpen: boolean
  urlValue: string
  urlBusy: boolean
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void
  onToggleUrl: () => void
  onUrlValueChange: (value: string) => void
  onUrlAdd: () => void
}

const copy = mediaContent.picker

/** Drag-and-drop target with the "Add media" (upload / from URL) menu. */
export default function MediaPickDropzone({
  inputRef,
  dragOver,
  uploadDisabled,
  urlOpen,
  urlValue,
  urlBusy,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileInput,
  onToggleUrl,
  onUrlValueChange,
  onUrlAdd,
}: MediaPickDropzoneProps) {
  // Render logic
  return (
    <div className="border-b p-3">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag target only; activation is via the Upload button/input below. */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver()
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-muted-foreground transition-colors',
          dragOver && 'border-primary bg-primary-soft/40 text-foreground',
        )}
      >
        <span className="text-body-strong">{copy.dropHint}</span>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button type="button" size="sm" disabled={uploadDisabled}>
                  <Plus aria-hidden />
                  {copy.addMedia}
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                <Upload aria-hidden />
                {copy.uploadFiles}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleUrl}>
                <LinkIcon aria-hidden />
                {copy.fromUrl}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      </div>
      {urlOpen ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            value={urlValue}
            onChange={(e) => onUrlValueChange(e.target.value)}
            placeholder={copy.fromUrlPlaceholder}
            aria-label={copy.fromUrl}
            className="flex-1"
          />
          <Button type="button" size="sm" disabled={urlBusy || !urlValue.trim()} onClick={onUrlAdd}>
            {urlBusy ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            {urlBusy ? copy.fromUrlBusy : copy.fromUrlAdd}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
