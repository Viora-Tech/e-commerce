'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  stepZoom,
  useCanvasZoom,
  ZOOM_STEPS,
  zoomLabel,
} from '@/lib/customize-zoom'

/**
 * The top bar's "1440 PX / 60 %" readout (Figma builder top bar): the width the page is laid
 * out at and the canvas zoom. It opens zoom in / out, Fit and the fixed 25–200 % levels.
 */
export default function ZoomMenu() {
  // Hooks
  const copy = useCopy(customizeContent.bar.zoom)
  const { zoom, mode, fit, devicePx, setMode } = useCanvasZoom()

  // Event handlers
  const handleLevel = (value: string) => setMode(value === 'fit' ? 'fit' : Number(value))

  // Render logic
  const pct = zoomLabel(zoom)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={copy.label(devicePx, pct)}
        title={copy.label(devicePx, pct)}
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-caption text-muted-foreground tabular-nums transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none data-[popup-open]:bg-muted/60 data-[popup-open]:text-foreground motion-reduce:transition-none',
        )}
      >
        <span>{pct}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-40">
        <DropdownMenuItem disabled={zoom >= MAX_ZOOM} onClick={() => setMode(stepZoom(zoom, 1))}>
          {copy.zoomIn}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={zoom <= MIN_ZOOM} onClick={() => setMode(stepZoom(zoom, -1))}>
          {copy.zoomOut}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={mode === 'fit' ? 'fit' : String(mode)}
          onValueChange={handleLevel}
        >
          <DropdownMenuRadioItem value="fit" closeOnClick>
            {copy.fit(zoomLabel(fit))}
          </DropdownMenuRadioItem>
          {ZOOM_STEPS.map((level) => (
            <DropdownMenuRadioItem
              key={level}
              value={String(level)}
              closeOnClick
              className="tabular-nums"
            >
              {zoomLabel(level)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
