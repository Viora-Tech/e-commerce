'use client'

import type { IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type KeyboardEvent, useId } from 'react'

type Option<T> = { label: string; value: T; icon?: IconComponent | undefined }

type SettingsSegmentedProps<T> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Hide the label above (a control that labels itself, like the device switch). */
  hideLabel?: boolean | undefined
  /** Stretch the segments to the row's width. */
  fill?: boolean | undefined
}

/**
 * A segmented choice from the Figma inspector (369:5142): a muted track holding the options,
 * the chosen one raised on a card. A radio group underneath, so arrow keys move the choice.
 */
export default function SettingsSegmented<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
  fill = true,
}: SettingsSegmentedProps<T>) {
  // Hooks
  const id = useId()

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!step) return
    e.preventDefault()
    const at = options.findIndex((o) => o.value === value)
    const next = options[(at + step + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {hideLabel ? null : (
        <span id={id} className="text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={hideLabel ? undefined : id}
        aria-label={hideLabel ? label : undefined}
        onKeyDown={handleKeyDown}
        className={cn('flex gap-0.5 rounded-lg bg-muted p-0.5', fill ? 'w-full' : 'w-fit')}
      >
        {options.map((o) => {
          const checked = o.value === value
          const Icon = o.icon
          return (
            // biome-ignore lint/a11y/useSemanticElements: a styled chip or segment in a radio group; a native radio input cannot carry this look.
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={Icon ? o.label : undefined}
              title={Icon ? o.label : undefined}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={cn(
                'flex h-7 min-w-0 items-center justify-center gap-1 rounded-md text-xs leading-[1.0625rem] font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
                fill && 'flex-1',
                // Four or more choices share a narrow panel: tighter sides keep every word whole.
                options.length > 3 ? 'px-1' : 'px-2.5',
                checked
                  ? 'bg-card text-foreground shadow-card'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {Icon ? <Icon aria-hidden weight="regular" className="size-3.5 shrink-0" /> : null}
              {Icon ? null : <span className="truncate">{o.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
