'use client'

import { imageEditorContent } from '@/data/image-editor'
import { useCopy } from '@/hooks/use-copy'
import type { ImageAdjust } from '@/lib/image-edit'

type ImageAdjustSlidersProps = {
  value: ImageAdjust
  onChange: (next: ImageAdjust) => void
  disabled?: boolean | undefined
}

const SLIDERS: readonly { key: keyof ImageAdjust; min: number }[] = [
  { key: 'brightness', min: -100 },
  { key: 'contrast', min: -100 },
  { key: 'saturation', min: -100 },
  { key: 'warmth', min: -100 },
  { key: 'sharpen', min: 0 },
]

/** The image editor's adjustment sliders; each shows its value and resets on double-click. */
export default function ImageAdjustSliders({ value, onChange, disabled }: ImageAdjustSlidersProps) {
  // Hooks
  const copy = useCopy(imageEditorContent.adjust)

  // Render logic
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="mb-1 text-body font-semibold text-foreground">{copy.heading}</legend>
      {SLIDERS.map(({ key, min }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-caption text-muted-foreground">
            <span>{copy[key]}</span>
            <span className="tabular-nums">{value[key]}</span>
          </span>
          <input
            type="range"
            min={min}
            max={100}
            step={1}
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
            onDoubleClick={() => onChange({ ...value, [key]: 0 })}
            className="h-1.5 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
          />
        </label>
      ))}
    </fieldset>
  )
}
