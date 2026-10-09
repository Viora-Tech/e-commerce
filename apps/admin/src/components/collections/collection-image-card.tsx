'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
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
    <Card size="form">
      <CardHeader className="grid-cols-[1fr_auto] items-center">
        <CardTitle>{copy.heading}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setPicking(true)}>
          {imageUrl ? copy.replace : copy.add}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/60">
          {imageUrl ? (
            // biome-ignore lint/performance/noImgElement: remote catalogue images, no optimisation pipeline yet.
            <img src={imageUrl} alt="" className="size-full object-contain p-4" />
          ) : (
            <span className="text-body text-muted-foreground">{copy.none}</span>
          )}
        </div>
        {imageUrl ? (
          <Button variant="ghost" size="sm" onClick={() => handlePicked(null)}>
            {copy.remove}
          </Button>
        ) : null}
      </CardContent>
      <MediaPickDialog
        open={picking}
        title={details.pickImage}
        onClose={() => setPicking(false)}
        onPick={handlePicked}
      />
    </Card>
  )
}
