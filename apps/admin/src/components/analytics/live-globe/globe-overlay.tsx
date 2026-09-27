'use client'

import { Minus, Plus, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { liveGlobeContent as copy } from '@/data/live-globe'
import type { GlobeMarker } from './types'

type GlobeOverlayProps = {
  markers: GlobeMarker[]
  activeId: string | null
  onActiveChange: (id: string | null) => void
  /** +1 zooms in a step, -1 out, 0 resets. */
  onZoom: (direction: -1 | 0 | 1) => void
}

/**
 * What sits over either globe's canvas: one focusable button per marker (moved into place
 * every frame by `positionOverlay`), the tooltip for the active one, and the zoom buttons in
 * the bottom-right corner.
 */
export default function GlobeOverlay({
  markers,
  activeId,
  onActiveChange,
  onZoom,
}: GlobeOverlayProps) {
  // Event handlers
  const handleMarkerEnter = (id: string) => onActiveChange(id)
  const handleMarkerLeave = (id: string) => {
    if (activeId === id) onActiveChange(null)
  }

  // Render logic
  const active = markers.find((m) => m.id === activeId)
  const zoomButtons = [
    { label: copy.zoomIn, icon: Plus, direction: 1 as const },
    { label: copy.zoomOut, icon: Minus, direction: -1 as const },
    { label: copy.zoomReset, icon: RotateCcw, direction: 0 as const },
  ]

  return (
    <>
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          data-marker-id={m.id}
          aria-label={m.label}
          className="absolute top-0 left-0 size-4 rounded-full opacity-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onPointerEnter={() => handleMarkerEnter(m.id)}
          onPointerLeave={() => handleMarkerLeave(m.id)}
          onFocus={() => handleMarkerEnter(m.id)}
          onBlur={() => handleMarkerLeave(m.id)}
        />
      ))}
      {active ? (
        <div
          data-globe-tooltip
          role="tooltip"
          className="pointer-events-none absolute top-0 left-0 z-10 min-w-max rounded-lg border border-border bg-popover px-3 py-2 text-caption shadow-lift transition-opacity"
        >
          {active.tooltip}
        </div>
      ) : null}
      <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1 rounded-lg border border-border bg-popover/90 p-1 shadow-lift backdrop-blur-sm">
        {zoomButtons.map(({ label, icon: Icon, direction }) => (
          <Button
            key={label}
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={label}
            onClick={() => onZoom(direction)}
          >
            <Icon className="size-4" />
          </Button>
        ))}
      </div>
    </>
  )
}
