'use client'

import {
  isThemePreviewMessage,
  THEME_PREVIEW_PARAM,
  type Theme,
  type ThemePreviewApply,
} from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useRef, useState } from 'react'
import { themesContent as copy } from '@/data/themes'

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile'

type ThemePreviewProps = {
  theme: Theme
  mode: 'light' | 'dark'
  device: PreviewDevice
  /** Storefront origin, e.g. http://localhost:3100; also the only origin messages go to. */
  origin: string
  previewToken: string
}

const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[48rem] max-w-full',
  mobile: 'w-[24.375rem] max-w-full',
}

/**
 * The live storefront in a frame. The frame loads with a signed preview token; once the
 * storefront has verified it, it says `ready` and from then on every draft change is
 * posted to it. Nothing is saved until the merchant presses Save.
 */
export default function ThemePreview({
  theme,
  mode,
  device,
  origin,
  previewToken,
}: ThemePreviewProps) {
  // Hooks
  // Counts page loads inside the frame; each one announces itself and needs the draft again.
  const [loads, setLoads] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return
      if (isThemePreviewMessage(event.data) && event.data.type === 'theme-preview:ready') {
        setLoads((n) => n + 1)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [origin])

  useEffect(() => {
    if (loads === 0) return
    const message: ThemePreviewApply = { type: 'theme-preview:apply', theme, mode }
    frame.current?.contentWindow?.postMessage(message, origin)
  }, [loads, theme, mode, origin])

  // Render logic
  const ready = loads > 0
  const src = `${origin}/?${THEME_PREVIEW_PARAM}=${encodeURIComponent(previewToken)}`

  return (
    <div className="relative flex h-full justify-center overflow-hidden rounded-lg border border-border bg-muted">
      <iframe
        ref={frame}
        src={src}
        title={copy.preview.label}
        className={cn('h-full bg-card transition-[width] duration-300', DEVICE_WIDTH[device])}
      />
      {ready ? null : (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-caption text-muted-foreground shadow-popover">
            <Spinner />
            {copy.preview.connecting}
          </span>
        </div>
      )}
    </div>
  )
}
