'use client'

import { BlockStack, Card, DropZone, InlineGrid, Text, Thumbnail } from '@shopify/polaris'
import { productFormContent } from '@/data/products'

type MediaCardProps = {
  images: { id: string; url: string; alt: string | null }[]
}

const copy = productFormContent.media

/** Read-only for now: uploads arrive with the media library PR (extension point: `onDrop`). */
export function MediaCard({ images }: MediaCardProps) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {copy.heading}
        </Text>
        {images.length > 0 ? (
          <InlineGrid columns={{ xs: 3, md: 5 }} gap="200">
            {images.map((img) => (
              <Thumbnail key={img.id} source={img.url} alt={img.alt ?? ''} size="large" />
            ))}
          </InlineGrid>
        ) : null}
        <DropZone disabled label={images.length === 0 ? copy.empty : undefined} labelHidden>
          <DropZone.FileUpload actionHint={copy.uploadSoon} />
        </DropZone>
      </BlockStack>
    </Card>
  )
}
