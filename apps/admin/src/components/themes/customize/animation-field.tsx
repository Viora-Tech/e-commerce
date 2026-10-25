'use client'

import { RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'

type AnimationFieldProps = {
  label: string
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}

const copy = customizeContent.settingsControls

/** The poses `section-reveal.tsx` starts a section from, so the preview plays the real thing. */
const FROM: Record<string, { opacity: number; y?: number; scale?: number }> = {
  fade: { opacity: 0 },
  'slide-up': { opacity: 0, y: 24 },
  zoom: { opacity: 0, scale: 0.96 },
}

/**
 * The entrance animation as a select with a preview label beside it: choosing an effect (or
 * pressing the label) plays it on the label, so the merchant sees it without scrolling the
 * canvas. Under reduced motion the label stays still, as the section itself would.
 */
export default function AnimationField({ label, options, value, onChange }: AnimationFieldProps) {
  // Hooks
  const id = useId()
  const reducedMotion = useReducedMotion()
  const [plays, setPlays] = useState(0)

  // Event handlers
  const handleChange = (next: unknown) => {
    if (typeof next !== 'string') return
    onChange(next)
    setPlays((n) => n + 1)
  }

  // Render logic
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))
  const from = FROM[value]
  const animate = from && !reducedMotion

  return (
    <FieldFrame label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <Select items={items} value={value} onValueChange={handleChange}>
          <SelectTrigger id={id} className={cn(FIELD_CONTROL, 'min-w-0 flex-1')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => setPlays((n) => n + 1)}
          disabled={!animate}
          aria-label={copy.replay}
          title={copy.replay}
          className="flex h-8 w-24 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-muted text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:hover:bg-muted motion-reduce:transition-none"
        >
          <motion.span
            key={`${value}-${plays}`}
            initial={animate ? from : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-1"
          >
            {animate ? (
              <RotateCcw aria-hidden weight="regular" className="size-3 text-muted-foreground" />
            ) : null}
            {copy.animationPreview}
          </motion.span>
        </button>
      </div>
    </FieldFrame>
  )
}
