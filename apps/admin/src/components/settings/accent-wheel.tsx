'use client'

import { useRef, useState } from 'react'
import { appearanceContent } from '@/data/appearance'
import { type Hsv, hexToHsv, hsvToHex, wheelPoint, wheelPosition } from '@/lib/color-wheel'

type AccentWheelProps = {
  /** `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
}

const copy = appearanceContent.accent

/** Arrow keys move the handle this many degrees of hue / this much saturation. */
const HUE_STEP = 5
const SAT_STEP = 0.05

/**
 * The colour wheel beside the preset accents: hue around the circle, saturation from the centre
 * out, brightness on the slider below. Drag, click or use the arrow keys.
 */
export default function AccentWheel({ value, onChange }: AccentWheelProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)
  // The wheel keeps its own hue while saturation or brightness is zero (grey has no hue).
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))

  // Helpers
  const commit = (next: Hsv) => {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  const pick = (clientX: number, clientY: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const r = box.width / 2
    const { h, s } = wheelPoint((clientX - box.left - r) / r, (clientY - box.top - r) / r)
    commit({ ...hsv, h, s, v: hsv.v || 1 })
  }

  // Event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pick(e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX, e.clientY)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { h: (hsv.h - HUE_STEP + 360) % 360 },
      ArrowRight: { h: (hsv.h + HUE_STEP) % 360 },
      ArrowUp: { s: Math.min(1, hsv.s + SAT_STEP) },
      ArrowDown: { s: Math.max(0, hsv.s - SAT_STEP) },
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    commit({ ...hsv, ...move })
  }

  // Render logic
  const shown = hexToHsv(value)
  // Follow outside changes (a preset, a typed hex) unless they are the wheel's own grey.
  const current = shown.s > 0 && shown.v > 0 ? { ...shown } : { ...hsv, v: shown.v }
  const at = wheelPosition(current.h, current.s)
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={copy.wheel}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(current.h)}
        aria-valuetext={value}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKey}
        className="relative size-40 shrink-0 cursor-crosshair touch-none rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          background:
            'radial-gradient(circle closest-side, #fff, transparent), conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
          filter: `brightness(${Math.max(0.15, current.v)})`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
          style={{ left: `${at.left}%`, top: `${at.top}%`, backgroundColor: value }}
        />
      </div>
      <label className="flex max-w-40 flex-col gap-1.5 text-caption text-muted-foreground">
        {copy.brightness}
        <input
          type="range"
          min={15}
          max={100}
          value={Math.round(current.v * 100)}
          onChange={(e) => commit({ ...current, v: Number(e.target.value) / 100 })}
          className="accent-[var(--primary)]"
        />
      </label>
    </div>
  )
}
