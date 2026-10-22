'use client'

import { THEME_PRESET_IDS, THEME_PRESETS, type ThemePresetId } from '@commerce/core/theme'
import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

/** Where a new theme starts: a preset's look over the live theme's pages, or a blank theme. */
export type ThemeStart = ThemePresetId | 'blank'

type AddThemeDialogProps = {
  open: boolean
  busy: boolean
  /** The choice selected when the dialog opens ("Start from scratch" in the menu picks blank). */
  initialStart?: ThemeStart | undefined
  onOpenChange: (open: boolean) => void
  onAdd: (input: { start: ThemeStart; name: string }) => void
}

const TILE =
  'flex items-center gap-3 rounded-lg border p-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const tileState = (active: boolean) =>
  active ? 'border-primary ring-1 ring-primary' : 'border-border hover:shadow-card-hover'

/**
 * Add theme: pick a preset, or start from scratch (base settings, empty pages), and optionally
 * name it. The new theme lands unpublished.
 */
export default function AddThemeDialog({
  open,
  busy,
  initialStart = 'waimers',
  onOpenChange,
  onAdd,
}: AddThemeDialogProps) {
  // Hooks
  const copy = useCopy(themesContent.addDialog)
  const presetCopy = useCopy(themesContent.presets)
  const [start, setStart] = useState<ThemeStart>(initialStart)
  const [name, setName] = useState('')

  // Render logic
  const presets = presetCopy.items
  const startLabel = start === 'blank' ? copy.blankName : presets[start].label
  const finalName = name.trim() || startLabel

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESET_IDS.map((id) => {
            const p = THEME_PRESETS[id]
            return (
              <button
                key={id}
                type="button"
                aria-pressed={start === id}
                onClick={() => setStart(id)}
                className={cn(TILE, tileState(start === id))}
              >
                <span
                  aria-hidden
                  className="size-10 shrink-0 rounded-md border border-border"
                  style={{
                    background: `linear-gradient(135deg, ${p.light.background} 50%, ${p.light.button} 50%)`,
                  }}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body font-semibold text-foreground">
                    {presets[id].label}
                  </span>
                  <span className="text-caption text-muted-foreground">{presets[id].body}</span>
                </span>
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={start === 'blank'}
            onClick={() => setStart('blank')}
            className={cn(TILE, 'col-span-2', tileState(start === 'blank'))}
          >
            <span
              aria-hidden
              className="size-10 shrink-0 rounded-md border border-dashed border-border bg-muted"
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-semibold text-foreground">{copy.blank}</span>
              <span className="text-caption text-muted-foreground">{copy.blankBody}</span>
            </span>
          </button>
        </div>
        <Field>
          <FieldLabel htmlFor="theme-name">{copy.name}</FieldLabel>
          <Input
            id="theme-name"
            size="lg"
            value={name}
            maxLength={50}
            placeholder={startLabel}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => onAdd({ start, name: finalName })}>
            {busy ? <Spinner /> : <Plus aria-hidden="true" />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
