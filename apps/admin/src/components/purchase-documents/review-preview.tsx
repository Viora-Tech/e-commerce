'use client'

import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'

type ReviewPreviewProps = {
  /** An object URL of the private file, fetched through the API. Null while loading. */
  file: { url: string; type: string } | null
  name: string
}

/** The uploaded file itself, beside what the AI read, so every value can be checked by eye. */
export default function ReviewPreview({ file, name }: ReviewPreviewProps) {
  // Hooks
  const copy = useCopy(documentReviewContent)

  // Render logic
  const isPdf = file?.type === 'application/pdf'

  return (
    <div className="flex min-h-[40dvh] flex-col border-line border-b bg-muted lg:min-h-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <span className="truncate text-caption font-medium text-muted-foreground">
          {name || copy.previewTitle}
        </span>
        {file ? (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={file.url} target="_blank" rel="noopener" />}
          >
            <ExternalLink aria-hidden="true" />
            {copy.openInTab}
          </Button>
        ) : null}
      </div>
      {!file ? (
        <div className="flex-1" />
      ) : isPdf ? (
        <iframe
          title={name || copy.previewTitle}
          src={file.url}
          className="min-h-0 w-full flex-1 bg-background"
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          {/* biome-ignore lint/performance/noImgElement: a private object URL, never a public image */}
          <img src={file.url} alt={name} className="mx-auto max-w-full rounded-md shadow-sm" />
        </div>
      )}
    </div>
  )
}
