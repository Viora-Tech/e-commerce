'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

type FallbackImageProps = {
  src: string | null | undefined
  /** Shown when there is no image or it fails to load (a deleted upload, a dead link). */
  fallback: ReactNode
  alt?: string
  className?: string
}

/** A remote store image that shows `fallback` instead of the browser's broken-image glyph. */
export default function FallbackImage({ src, fallback, alt = '', className }: FallbackImageProps) {
  // Hooks
  const [failed, setFailed] = useState<string | null>(null)
  const img = useRef<HTMLImageElement>(null)
  /* A server-rendered image can fail before hydration attaches onError; catch that on mount. */
  useEffect(() => {
    const el = img.current
    if (src && el?.complete && el.naturalWidth === 0) setFailed(src)
  }, [src])

  // Early returns
  if (!src || failed === src) return <>{fallback}</>

  // Render logic
  return (
    // biome-ignore lint/performance/noImgElement: store uploads and remote catalogue images.
    <img ref={img} src={src} alt={alt} className={className} onError={() => setFailed(src)} />
  )
}
