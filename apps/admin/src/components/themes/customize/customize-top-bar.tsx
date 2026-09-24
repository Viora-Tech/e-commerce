'use client'

import { ArrowLeft, Monitor, Moon, Redo, Smartphone, Sun, Tablet, Undo } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCustomizePuck } from '@/lib/customize-puck'
import type { PreviewDevice } from '../theme-preview'

type CustomizeTopBarProps = {
  name: string
  live: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  canPublish: boolean
  device: PreviewDevice
  mode: 'light' | 'dark'
  darkMode: boolean
  /** Template and resource pickers. */
  pickers: ReactNode
  onDevice: (device: PreviewDevice) => void
  onMode: (mode: 'light' | 'dark') => void
  onDiscard: () => void
  onSave: () => void
  onPublish: () => void
}

const copy = customizeContent.bar
const editor = themesContent.editor
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

/** Customize's bar: back, theme, template picker, preview size, undo and redo, Save and Publish. */
export default function CustomizeTopBar({
  name,
  live,
  dirty,
  saving,
  publishing,
  canPublish,
  device,
  mode,
  darkMode,
  pickers,
  onDevice,
  onMode,
  onDiscard,
  onSave,
  onPublish,
}: CustomizeTopBarProps) {
  // Hooks
  const history = useCustomizePuck((s) => s.history)

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
          aria-label={editor.back}
          title={editor.back}
          nativeButton={false}
          render={<Link href="/online-store/themes" />}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <h1 className="truncate text-body font-semibold text-foreground">{name}</h1>
        <Badge variant={live ? 'success' : 'neutral'}>{live ? editor.live : editor.draft}</Badge>
      </div>
      <div className="flex items-center gap-2">{pickers}</div>
      <div className="flex items-center justify-end gap-2">
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
        <Button
          variant="ghost"
          size="icon"
          onClick={history.back}
          disabled={!history.hasPast}
          aria-label={copy.undo}
          title={copy.undo}
        >
          <Undo aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={history.forward}
          disabled={!history.hasFuture}
          aria-label={copy.redo}
          title={copy.redo}
        >
          <Redo aria-hidden />
        </Button>
        <span className="hidden text-caption text-muted-foreground xl:inline" aria-live="polite">
          {dirty ? copy.unsaved : copy.upToDate}
        </span>
        {dirty ? (
          <Button variant="ghost" onClick={onDiscard} disabled={saving}>
            {copy.discard}
          </Button>
        ) : null}
        <Button variant="default" onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Spinner /> : null}
          {copy.save}
        </Button>
        {!live && canPublish ? (
          <Button
            onClick={onPublish}
            disabled={dirty || publishing}
            title={dirty ? editor.publishUnsaved : undefined}
          >
            {publishing ? <Spinner /> : null}
            {publishing ? editor.publishing : editor.publish}
          </Button>
        ) : null}
      </div>
    </header>
  )
}
