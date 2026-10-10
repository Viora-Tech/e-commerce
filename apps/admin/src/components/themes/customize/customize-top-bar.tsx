'use client'

import {
  ArrowLeft,
  Eye,
  Monitor,
  MoreHorizontal,
  Redo,
  Smartphone,
  Tablet,
  Undo,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { useCustomizePuck } from '@/lib/customize-puck'
import { routes } from '@/lib/routes'
import type { PreviewDevice } from '../theme-preview'
import ZoomMenu from './zoom-menu'

type CustomizeTopBarProps = {
  name: string
  live: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  canPublish: boolean
  device: PreviewDevice
  /** The storefront preview link for this theme. */
  previewHref: string
  /** Template and resource pickers. */
  pickers: ReactNode
  onDevice: (device: PreviewDevice) => void
  onDiscard: () => void
  onSave: () => void
  onPublish: () => void
}

const DEVICES = [
  { value: 'desktop', icon: Monitor },
  { value: 'tablet', icon: Tablet },
  { value: 'mobile', icon: Smartphone },
] as const

const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:size-4'

/**
 * Customize's bar (Figma "Website builder"): back to Themes, theme name and Live chip on the
 * left; the page switcher centred; device switch, the "1440 PX / 60 %" zoom readout, undo and redo,
 * Preview and Publish on the right.
 * On the live theme Publish commits the saved drafts (what Save did); on a draft theme the key
 * button stays Save and the menu publishes the whole theme.
 */
export default function CustomizeTopBar({
  name,
  live,
  dirty,
  saving,
  publishing,
  canPublish,
  device,
  previewHref,
  pickers,
  onDevice,
  onDiscard,
  onSave,
  onPublish,
}: CustomizeTopBarProps) {
  // Hooks
  const copy = useCopy(customizeContent.bar)
  const editor = useCopy(themesContent.editor)
  const devices = useCopy(themesContent.preview.devices)
  const history = useCustomizePuck((s) => s.history)

  // Render logic
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          className="gap-1.5 rounded-lg px-2"
          title={editor.back}
          nativeButton={false}
          render={<Link href={routes.onlineStore.themes()} />}
        >
          <ArrowLeft aria-hidden className="size-4" />
          {copy.themes}
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-body font-semibold text-foreground">{name}</h1>
          <StatusChip>{live ? editor.live : editor.draft}</StatusChip>
        </div>
      </div>
      <div className="flex items-center gap-2">{pickers}</div>
      <div className="flex items-center justify-end gap-2">
        <fieldset
          aria-label={copy.device}
          className="m-0 flex min-w-0 items-center gap-0.5 rounded-lg border border-hairline bg-chip-neutral p-0.5"
        >
          {DEVICES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onDevice(value)}
              aria-label={devices[value]}
              aria-pressed={device === value}
              title={devices[value]}
              className={cn(
                ICON_BUTTON,
                'size-7 rounded-md',
                device === value && 'bg-card text-foreground shadow-sm ring-1 ring-border',
              )}
            >
              <Icon aria-hidden weight="regular" />
            </button>
          ))}
        </fieldset>
        <ZoomMenu />
        <button
          type="button"
          onClick={history.back}
          disabled={!history.hasPast}
          aria-label={copy.undo}
          title={copy.undo}
          className={ICON_BUTTON}
        >
          <Undo aria-hidden weight="regular" />
        </button>
        <button
          type="button"
          onClick={history.forward}
          disabled={!history.hasFuture}
          aria-label={copy.redo}
          title={copy.redo}
          className={ICON_BUTTON}
        >
          <Redo aria-hidden weight="regular" />
        </button>
        <span
          role="status"
          className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground"
          aria-live="polite"
        >
          {dirty ? (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
          ) : null}
          <span className="hidden 2xl:inline">{dirty ? copy.unsaved : copy.upToDate}</span>
        </span>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={previewHref} target="_blank" rel="noreferrer" />}
        >
          <Eye aria-hidden />
          {copy.preview}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg"
                aria-label={copy.more}
                title={copy.more}
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!dirty || saving} onClick={onDiscard}>
              {copy.discard}
            </DropdownMenuItem>
            {!live && canPublish ? (
              <DropdownMenuItem
                disabled={dirty || publishing}
                onClick={onPublish}
                title={dirty ? editor.publishUnsaved : undefined}
              >
                {publishing ? editor.publishing : editor.publish}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={onSave} disabled={!dirty || saving}>
          {saving ? <Spinner /> : null}
          {live ? copy.publish : copy.save}
        </Button>
      </div>
    </header>
  )
}
