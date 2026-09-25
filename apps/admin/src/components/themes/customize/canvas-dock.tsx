'use client'

import { Monitor, Moon, Redo, Smartphone, Sun, Tablet, Undo } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCustomizePuck } from '@/lib/customize-puck'
import type { PreviewDevice } from '../theme-preview'

type CanvasDockProps = {
  device: PreviewDevice
  mode: 'light' | 'dark'
  /** Show the light/dark switch only when the theme has a dark mode. */
  darkMode: boolean
  onDevice: (device: PreviewDevice) => void
  onMode: (mode: 'light' | 'dark') => void
}

const copy = customizeContent.bar
const preview = themesContent.preview

const DEVICES = [
  { value: 'desktop', icon: Monitor },
  { value: 'tablet', icon: Tablet },
  { value: 'mobile', icon: Smartphone },
] as const
const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

const DOCK_BUTTON =
  'flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4'
const DOCK_ACTIVE =
  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'

const DIVIDER_CLASS = 'mx-1 h-5 w-px bg-border'

/** Floating pill under the canvas: preview size, light/dark, undo and redo. */
export default function CanvasDock({ device, mode, darkMode, onDevice, onMode }: CanvasDockProps) {
  // Hooks
  const history = useCustomizePuck((s) => s.history)

  // Render logic
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-popover p-1 shadow-popover">
        {DEVICES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onDevice(value)}
            aria-label={preview.devices[value]}
            aria-pressed={device === value}
            title={preview.devices[value]}
            className={cn(DOCK_BUTTON, device === value && DOCK_ACTIVE)}
          >
            <Icon aria-hidden weight="light" />
          </button>
        ))}
        {darkMode ? (
          <>
            <span aria-hidden className={DIVIDER_CLASS} />
            {MODES.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onMode(value)}
                aria-label={preview.modes[value]}
                aria-pressed={mode === value}
                title={preview.modes[value]}
                className={cn(DOCK_BUTTON, mode === value && DOCK_ACTIVE)}
              >
                <Icon aria-hidden weight="light" />
              </button>
            ))}
          </>
        ) : null}
        <span aria-hidden className={DIVIDER_CLASS} />
        <button
          type="button"
          onClick={history.back}
          disabled={!history.hasPast}
          aria-label={copy.undo}
          title={copy.undo}
          className={DOCK_BUTTON}
        >
          <Undo aria-hidden weight="light" />
        </button>
        <button
          type="button"
          onClick={history.forward}
          disabled={!history.hasFuture}
          aria-label={copy.redo}
          title={copy.redo}
          className={DOCK_BUTTON}
        >
          <Redo aria-hidden weight="light" />
        </button>
      </div>
    </div>
  )
}
