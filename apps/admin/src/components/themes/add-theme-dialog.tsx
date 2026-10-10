'use client'

import { THEME_PRESET_IDS, THEME_PRESETS, type ThemePresetId } from '@commerce/core/theme'
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

type AddThemeDialogProps = {
  open: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (input: { preset: ThemePresetId; name: string }) => void
}

const copy = themesContent.addDialog
const presets = themesContent.presets.items

/** Add theme: pick a preset, optionally name it. The new theme lands unpublished. */
export default function AddThemeDialog({ open, busy, onOpenChange, onAdd }: AddThemeDialogProps) {
  // Hooks
  const [preset, setPreset] = useState<ThemePresetId>('waimers')
  const [name, setName] = useState('')

  // Render logic
  const finalName = name.trim() || presets[preset].label

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
            const active = preset === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setPreset(id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:shadow-card-hover',
                )}
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
        </div>
        <Field>
          <FieldLabel htmlFor="theme-name">{copy.name}</FieldLabel>
          <Input
            id="theme-name"
            size="lg"
            value={name}
            maxLength={50}
            placeholder={presets[preset].label}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={busy} onClick={() => onAdd({ preset, name: finalName })}>
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
