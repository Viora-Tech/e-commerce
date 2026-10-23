'use client'

import { walkNodes } from '@commerce/core/automations'
import { Minus, Plus, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { triggerLabel } from '@/lib/automation-labels'
import { KIND_TONE, TRIGGER_GROUP_ICON } from '@/lib/automation-node-view'
import CanvasBranch from './canvas-branch'
import CanvasNode from './canvas-node'
import type { CanvasContext } from './types'

type WorkflowCanvasProps = {
  ctx: CanvasContext
  /** Removes a step (Delete or Backspace on a focused card). */
  onRemove?: ((id: string) => void) | undefined
  className?: string
}

const ZOOMS = [0.5, 0.75, 0.9, 1, 1.25] as const
const DEFAULT_ZOOM = 3

/**
 * Flow's vertical canvas: the trigger card on top, then the steps; conditions split into Then
 * and Otherwise columns. Keyboard: arrows move between cards, Enter opens one, Delete removes it.
 */
export default function WorkflowCanvas({ ctx, onRemove, className }: WorkflowCanvasProps) {
  // Hooks
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  // Event handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFieldSetElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-node-id]')
    const current = target?.dataset.nodeId
    if (!current) return
    const order = ['trigger', ...walkNodes(ctx.def).map((n) => n.id)]
    const at = order.indexOf(current)
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0
    if (step !== 0) {
      const next = order[at + step]
      if (!next) return
      e.preventDefault()
      e.currentTarget.querySelector<HTMLElement>(`[data-node-id="${next}"]`)?.focus()
      return
    }
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      current !== 'trigger' &&
      onRemove &&
      !ctx.readOnly
    ) {
      e.preventDefault()
      onRemove(current)
    }
  }

  // Render logic
  const scale = ZOOMS[zoom] ?? 1
  const trigger = ctx.catalogue.triggers.find((t) => t.id === ctx.def.trigger.type) ?? null
  const title = triggerLabel(ctx.pieces, ctx.locale, trigger, ctx.def.trigger.type)
  const { copy } = ctx

  return (
    <div
      className={`relative min-h-0 overflow-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:1rem_1rem] ${className ?? ''}`}
    >
      <fieldset
        aria-label={copy.canvas.label}
        aria-description={copy.canvas.keyboardHint}
        onKeyDown={handleKeyDown}
        className="m-0 flex w-max min-w-full origin-top flex-col items-center border-0 px-6 py-8"
        style={{ transform: `scale(${scale})` }}
      >
        <CanvasNode
          id="trigger"
          kind={copy.canvas.trigger}
          title={title}
          icon={TRIGGER_GROUP_ICON[trigger?.group ?? 'orders']}
          tone={KIND_TONE.trigger}
          selected={ctx.selected === 'trigger'}
          flagged={ctx.flagged.has('trigger')}
          mark={ctx.marks ? 'ran' : undefined}
          labels={{
            issue: copy.canvas.issue,
            asks: copy.canvas.asks,
            sensitive: copy.canvas.sensitive,
            messages: copy.canvas.messages,
          }}
          onSelect={ctx.onSelect}
        />
        <CanvasBranch ctx={ctx} edge={{ parent: null }} insertLabel={copy.canvas.addAfter(title)} />
      </fieldset>
      <div className="sticky bottom-3 left-3 ml-3 inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-card">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.canvas.zoomOut}
          disabled={zoom === 0}
          onClick={() => setZoom(zoom - 1)}
        >
          <Minus />
        </Button>
        <span className="w-12 text-center text-caption tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.canvas.zoomIn}
          disabled={zoom === ZOOMS.length - 1}
          onClick={() => setZoom(zoom + 1)}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={copy.canvas.zoomReset}
          onClick={() => setZoom(DEFAULT_ZOOM)}
        >
          <RotateCcw />
        </Button>
      </div>
    </div>
  )
}
