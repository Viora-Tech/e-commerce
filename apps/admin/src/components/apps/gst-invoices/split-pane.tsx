'use client'

import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'

type SplitPaneProps = {
  left: ReactNode
  right: ReactNode
  label: string
}

const MIN = 32
const MAX = 68

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, n))

/** A resizable two-column layout: drag or arrow-key the divider. Stacks on small screens. */
export default function SplitPane({ left, right, label }: SplitPaneProps) {
  // Hooks
  const [percent, setPercent] = useState(46)
  const boxRef = useRef<HTMLDivElement>(null)

  // Event handlers
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId) || !boxRef.current) return
    const box = boxRef.current.getBoundingClientRect()
    setPercent(clamp(((e.clientX - box.left) / box.width) * 100))
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setPercent((p) => clamp(p - 2))
    if (e.key === 'ArrowRight') setPercent((p) => clamp(p + 2))
  }

  return (
    <div
      ref={boxRef}
      className="flex flex-col gap-4 lg:grid lg:grid-cols-[var(--split-left)_0.75rem_var(--split-right)] lg:gap-0"
      style={
        {
          '--split-left': `${percent}fr`,
          '--split-right': `${100 - percent}fr`,
        } as React.CSSProperties
      }
    >
      <div className="flex min-w-0 flex-col gap-3">{left}</div>
      {/* biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused and dragged. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className="group hidden cursor-col-resize touch-none justify-center focus-visible:outline-none lg:flex"
      >
        <span className="h-full w-px bg-border transition-colors group-hover:bg-ring group-focus-visible:bg-ring" />
      </div>
      <div className="min-w-0 lg:sticky lg:top-[4.5rem] lg:self-start">{right}</div>
    </div>
  )
}
