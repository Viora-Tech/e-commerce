'use client'

import { Minus, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type FocusEvent, useEffect, useState } from 'react'
import { inventoryContent } from '@/data/inventory'

type AvailableCellProps = {
  name: string
  available: number
  /** At or below this (and above zero) the number turns amber. */
  lowAt: number
  disabled?: boolean
  /** The input's name for screen readers; defaults to "Available for …" (On hand reuses the cell). */
  label?: (name: string) => string
  /** Called once the group loses focus with a changed value; resolves when saved. */
  onCommit: (delta: number) => Promise<boolean>
}

const copy = inventoryContent.cell

// Resting cell is a plain bordered number (Figma 279:15066); the steppers open on hover or focus.
const STEP =
  'flex h-7 w-0 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground opacity-0 transition-[width,opacity,color] duration-150 ease-out hover:text-foreground disabled:opacity-40 group-focus-within:w-7 group-focus-within:opacity-100 group-hover:w-7 group-hover:opacity-100'

function parse(text: string): number | null {
  if (!/^-?\d+$/.test(text.trim())) return null
  return Number.parseInt(text, 10)
}

/**
 * Available count you can type over or nudge with the steppers. The edit is
 * saved when focus leaves the cell, so several clicks become one adjustment.
 */
export default function AvailableCell({
  name,
  available,
  lowAt,
  disabled,
  label = copy.label,
  onCommit,
}: AvailableCellProps) {
  // Hooks
  const [text, setText] = useState(String(available))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setText(String(available))
  }, [available])

  // Helpers
  const commit = async () => {
    const next = parse(text)
    if (next === null) {
      setText(String(available))
      return
    }
    if (next === available) return
    setSaving(true)
    const ok = await onCommit(next - available)
    setSaving(false)
    if (!ok) setText(String(available))
  }

  const step = (by: number) => {
    const current = parse(text) ?? available
    setText(String(current + by))
  }

  // Event handlers
  const handleBlur = (e: FocusEvent<HTMLFieldSetElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    void commit()
  }

  // Render logic
  const changed = parse(text) !== available
  const locked = disabled || saving

  return (
    <fieldset
      aria-label={label(name)}
      className={cn(
        'group mx-auto flex w-fit min-w-0 items-center gap-0.5 rounded-lg border border-line bg-card p-0.5 transition-colors',
        changed && 'border-primary',
      )}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className={STEP}
        aria-label={copy.decrease}
        disabled={locked}
        onClick={() => step(-1)}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        value={text}
        inputMode="numeric"
        aria-label={label(name)}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setText(String(available))
        }}
        className={cn(
          'h-7 w-11 rounded-md bg-transparent text-center text-kit-cell tabular-nums outline-none focus:bg-background',
          available <= 0 && !changed && 'text-destructive',
          available > 0 && available <= lowAt && !changed && 'text-warning',
        )}
      />
      <button
        type="button"
        className={STEP}
        aria-label={copy.increase}
        disabled={locked}
        onClick={() => step(1)}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </fieldset>
  )
}
