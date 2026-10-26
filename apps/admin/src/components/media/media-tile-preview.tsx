'use client'

import type { MediaVariants } from '@commerce/core/media-loader'
import { ImageIcon, Video } from '@commerce/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { tileImageUrls, videoPreviewUrl } from './tile-sources'

type MediaTilePreviewProps = {
  url: string
  alt: string | null
  /** The pipeline's WebP/AVIF copies; null or absent until the file is optimised. */
  variants?: MediaVariants
  video: boolean
  /** File name under "Can't show this file". */
  name: string
}

/**
 * What a media tile shows: an image at about the tile's size (the original only when no
 * smaller copy exists or the copy fails), or a video's first frame. When nothing loads it says
 * "Can't show this file" instead of a blank grey box. The caller keys it by URL, so a replaced
 * file gets a fresh try.
 */
export default function MediaTilePreview({
  url,
  alt,
  variants,
  video,
  name,
}: MediaTilePreviewProps) {
  // Hooks
  const { tile: copy } = useCopy(mediaContent)
  /* How many URLs failed so far; past the last one the tile says it can't show the file. */
  const [failed, setFailed] = useState(0)
  const img = useRef<HTMLImageElement>(null)
  /* A server-rendered image can fail before hydration attaches onError; catch that on mount. */
  useEffect(() => {
    const el = img.current
    if (el?.complete && el.naturalWidth === 0) setFailed((n) => n + 1)
  }, [])

  // Event handlers
  const handleError = () => setFailed((n) => n + 1)

  // Early returns
  const sources = video ? [videoPreviewUrl(url)] : tileImageUrls({ url, variants })
  const src = sources[failed]
  if (!src) {
    const Icon = video ? Video : ImageIcon
    return (
      <span className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-caption text-muted-foreground">
        <Icon className="size-6" aria-hidden="true" />
        <span className="font-medium text-foreground">{copy.cantShow}</span>
        <span className="max-w-full truncate">{name}</span>
      </span>
    )
  }

  // Render logic
  return video ? (
    <video
      src={src}
      muted
      playsInline
      preload="metadata"
      onError={handleError}
      className="size-full object-cover"
    />
  ) : (
    // biome-ignore lint/performance/noImgElement: store uploads from whichever storage host the store uses.
    <img
      ref={img}
      src={src}
      alt={alt ?? ''}
      loading="lazy"
      decoding="async"
      onError={handleError}
      className="size-full object-cover"
    />
  )
}
