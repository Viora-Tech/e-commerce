'use client'

import { ImagePlus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import FallbackImage from '@/components/layout/fallback-image'
import MediaPickDialog from '@/components/media/media-pick-dialog'
import { collectionDetailContent, collectionFormContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'

type CollectionImageCardProps = {
  imageUrl: string | null
  onChange: (patch: { imageMediaId: string | null; imageUrl: string | null }) => void
}

/** "Collection image" card: preview with Replace (or Add) and Remove. */
export default function CollectionImageCard({ imageUrl, onChange }: CollectionImageCardProps) {
  // Hooks
  const { image: copy } = useCopy(collectionDetailContent)
  const { details } = useCopy(collectionFormContent)
  const [picking, setPicking] = useState(false)

  // Event handlers
  const handlePicked = (media: { id: string; url: string } | null) => {
    setPicking(false)
    onChange({ imageMediaId: media?.id ?? null, imageUrl: media?.url ?? null })
  }

  // Render logic
  return (
    <DataCard
      title={copy.heading}
      action={
        <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
          {imageUrl ? copy.replace : copy.add}
        </Button>
      }
      bodyClassName="flex flex-col items-start gap-3"
    >
      <FallbackImage
        src={imageUrl}
        className="aspect-[4/3] w-full rounded-lg bg-muted/60 object-contain p-4"
        fallback={
          /* Figma "Dropzone" (629:7288): a dashed box that opens the picker. */
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-md border border-border">
              <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
            </span>
            <span className="text-body text-ink-strong">{copy.none}</span>
            <span className="text-caption text-muted-foreground">{copy.add}</span>
          </button>
        }
      />
      {imageUrl ? (
        <Button variant="ghost" size="sm" onClick={() => handlePicked(null)}>
          {copy.remove}
        </Button>
      ) : null}
      <MediaPickDialog
        open={picking}
        title={details.pickImage}
        onClose={() => setPicking(false)}
        onPick={handlePicked}
      />
    </DataCard>
  )
}
