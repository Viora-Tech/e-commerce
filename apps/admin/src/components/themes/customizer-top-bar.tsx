'use client'

import { ArrowLeft, Monitor, Moon, Smartphone, Sun, Tablet } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { themesContent } from '@/data/themes'
import type { PreviewDevice } from './theme-preview'

type CustomizerTopBarProps = {
  name: string
  live: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  canPublish: boolean
  device: PreviewDevice
  mode: 'light' | 'dark'
  /** The dark toggle shows only when the theme offers dark mode. */
  darkMode: boolean
  onDevice: (device: PreviewDevice) => void
  onMode: (mode: 'light' | 'dark') => void
  onDiscard: () => void
  onSave: () => void
  onPublish: () => void
}

const copy = themesContent.editor
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

/** The editor's own bar: back, theme name, device and dark toggles, Save and Publish. */
export default function CustomizerTopBar({
  name,
  live,
  dirty,
  saving,
  publishing,
  canPublish,
  device,
  mode,
  darkMode,
  onDevice,
  onMode,
  onDiscard,
  onSave,
  onPublish,
}: CustomizerTopBarProps) {
  // Event handlers
  const handleDevice = (values: unknown[]) => {
    const next = DEVICES.find((d) => d.value === values[0])
    if (next) onDevice(next.value)
  }

  const handleMode = (values: unknown[]) => {
    const next = MODES.find((m) => m.value === values[0])
    if (next) onMode(next.value)
  }

  // Render logic
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.back}
          title={copy.back}
          nativeButton={false}
          render={<Link href="/online-store/themes" />}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <h1 className="truncate text-body font-semibold text-foreground">{name}</h1>
        <StatusChip tone={live ? 'success' : 'neutral'}>{live ? copy.live : copy.draft}</StatusChip>
      </div>
      <div className="flex items-center gap-2">
        <ToggleGroup value={[device]} onValueChange={handleDevice} variant="outline" spacing={0}>
          {DEVICES.map(({ value, icon: Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={preview.devices[value]}
              title={preview.devices[value]}
            >
              <Icon aria-hidden />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {darkMode ? (
          <ToggleGroup value={[mode]} onValueChange={handleMode} variant="outline" spacing={0}>
            {MODES.map(({ value, icon: Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={preview.modes[value]}
                title={preview.modes[value]}
              >
                <Icon aria-hidden />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2">
        <span className="hidden text-caption text-muted-foreground md:inline" aria-live="polite">
          {dirty ? copy.unsaved : copy.savedAt}
        </span>
        {dirty ? (
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            {copy.discard}
          </Button>
        ) : null}
        <Button variant={live ? 'default' : 'outline'} onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Spinner /> : null}
          {themesContent.save}
        </Button>
        {!live && canPublish ? (
          <Button
            onClick={onPublish}
            disabled={dirty || publishing}
            title={dirty ? copy.publishUnsaved : undefined}
          >
            {publishing ? <Spinner /> : null}
            {publishing ? copy.publishing : copy.publish}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
