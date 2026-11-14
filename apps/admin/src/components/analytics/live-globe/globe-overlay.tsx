'use client'

import { Minus, Plus, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { liveGlobeContent as copy } from '@/data/live-globe'
import type { GlobeMarker } from './types'

type GlobeOverlayProps = {
  markers: GlobeMarker[]
  activeId: string | null
  onActiveChange: (id: string | null) => void
  /** +1 zooms in a step, -1 out, 0 resets. */
  /** Left out to hide the zoom buttons (the Home card). */
  onZoom?: ((direction: -1 | 0 | 1) => void) | undefined
  /** The Live view hero's gear button (its own popover); left out on the Home card's cobe
   * globe, which stays exactly as it was. */
  settingsButton?: ReactNode
}

/**
 * What sits over either globe's canvas: one focusable button per marker (moved into place
 * every frame by `positionOverlay`), the tooltip for the active one, and the control stack
 * (gear, then zoom buttons) in the top-right corner — top, not bottom, so it is never cut off
 * by the bottom of a tall Live view hero on a short viewport; the gear's popover opens
 * downward and leftward from there, staying on screen too.
 */
export default function GlobeOverlay({
  markers,
  activeId,
  onActiveChange,
  onZoom,
  settingsButton,
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
      {onZoom ? (
        <div className="absolute top-2 right-2 z-10 flex flex-row gap-1 rounded-lg border border-border bg-popover p-1 shadow-lift">
          {settingsButton}
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
      ) : null}
    </>
  )
}
