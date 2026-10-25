'use client'

import {
  ChevronLeftIcon,
  Eye,
  Globe,
  Monitor,
  MoreHorizontal,
  Redo,
  Save,
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
import UserMenu from '@/components/layout/user-menu'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { useCustomizePuck } from '@/lib/customize-puck'
import type { EditorKey } from '@/lib/customize-shortcuts'
import { displayThemeName } from '@/lib/customize-theme-name'
import { initials } from '@/lib/initials'
import { routes } from '@/lib/routes'
import { useEditorKeys } from '@/lib/use-editor-keys'
import type { PreviewDevice } from '../theme-preview'
import FullViewButton from './full-view-button'
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
  /** This theme's Edit code page, in the ⋯ menu (Figma 699:93894). */
  codeHref: string
  /** Template and resource pickers. */
  pickers: ReactNode
  /** An AI gateway is set up: the green "AI connected" chip shows. */
  aiConnected: boolean
  /** The signed-in member, for the avatar and its menu at the far right. */
  user: { name: string; email: string }
  onDevice: (device: PreviewDevice) => void
  onDiscard: () => void
  onSave: () => void
  onPublish: () => void
  /** Opens Version history beside the canvas (Figma 697:4526). */
  onVersions: () => void
}

const DEVICES = [
  { value: 'desktop', icon: Monitor },
  { value: 'tablet', icon: Tablet },
  { value: 'mobile', icon: Smartphone },
] as const

const ICON_BUTTON =
  'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none [&_svg]:size-4'

/**
 * Customize's bar (Figma 369:4810): back to Themes, theme name and Live chip on the left; the
 * page switcher centred; device switch, the "1440 PX / 60 %" zoom readout, "AI connected", undo
 * and redo, Preview, Save, Publish and the member's avatar on the right.
 * With changes the chip reads "Unsaved changes" (Figma 369:126247). On a draft theme Save
 * (outline, only with changes) keeps them and Publish (the key button) makes the theme live,
 * saving first. On the live theme saving is publishing, so Publish alone commits the changes.
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
  codeHref,
  pickers,
  aiConnected,
  user,
  onDevice,
  onDiscard,
  onSave,
  onPublish,
  onVersions,
}: CustomizeTopBarProps) {
  // Hooks
  const copy = useCopy(customizeContent.bar)
  const editor = useCopy(themesContent.editor)
  const devices = useCopy(themesContent.preview.devices)
  const history = useCustomizePuck((s) => s.history)
  // ⌘/Ctrl + S saves (on the live theme that is Publish); 1, 2, 3 switch the device.
  useEditorKeys((key: EditorKey, e: KeyboardEvent) => {
    if (key === 'save') {
      e.preventDefault()
      if (dirty && !saving && !publishing) onSave()
    } else if (key === 'desktop' || key === 'tablet' || key === 'mobile') {
      onDevice(key)
    }
  })

  // Render logic
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          className="gap-1.5 rounded-lg px-2"
          title={editor.back}
          nativeButton={false}
          render={<Link href={routes.onlineStore.themes()} />}
        >
          <ChevronLeftIcon aria-hidden weight="regular" className="size-4" />
          {copy.themes}
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm leading-5 font-semibold text-foreground normal-case">
            {displayThemeName(name)}
          </h1>
          {dirty ? (
            <StatusChip tone="attention">{copy.unsaved}</StatusChip>
          ) : (
            <StatusChip tone={live ? 'success' : 'neutral'}>
              {live ? editor.live : editor.draft}
            </StatusChip>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">{pickers}</div>
      <div className="flex items-center justify-end gap-2">
        <fieldset
          aria-label={copy.device}
          className="m-0 flex min-w-0 items-center gap-0.5 rounded-[0.625rem] bg-muted p-[0.1875rem]"
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
                // Figma 369:4820: 36×30, 8px radius, an 18px glyph; the chosen one raised on a card.
                'h-[1.875rem] w-9 rounded-lg [&_svg]:size-[1.125rem]',
                device === value && 'bg-card text-foreground shadow-card',
              )}
            >
              <Icon aria-hidden weight="regular" />
            </button>
          ))}
        </fieldset>
        <ZoomMenu />
        <FullViewButton className={ICON_BUTTON} />
        {aiConnected ? (
          <StatusChip tone="success" className="hidden shrink-0 xl:inline-flex">
            {copy.aiConnected}
          </StatusChip>
        ) : null}
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
        <span role="status" aria-live="polite" className="sr-only">
          {dirty ? copy.unsaved : copy.upToDate}
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
            <DropdownMenuItem onClick={onVersions}>{copy.versions}</DropdownMenuItem>
            <DropdownMenuItem render={<Link href={codeHref} />}>{copy.editCode}</DropdownMenuItem>
            <DropdownMenuItem disabled={!dirty || saving} onClick={onDiscard}>
              {copy.discard}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {!live && dirty ? (
          <Button variant="outline" onClick={onSave} disabled={saving || publishing}>
            {saving && !publishing ? <Spinner /> : <Save aria-hidden="true" />}
            {copy.save}
          </Button>
        ) : null}
        {live ? (
          // On the live theme saving is going live: one Save, named as such, like Shopify's.
          <Button onClick={onSave} disabled={!dirty || saving} title={copy.saveLiveHint}>
            {saving ? <Spinner /> : <Save aria-hidden="true" />}
            {copy.save}
          </Button>
        ) : canPublish ? (
          <Button onClick={onPublish} disabled={saving || publishing}>
            {publishing ? <Spinner /> : <Globe aria-hidden="true" />}
            {publishing ? editor.publishing : copy.publish}
          </Button>
        ) : null}
        <UserMenu
          user={user}
          bugReports={false}
          triggerLabel={copy.account}
          triggerClassName="flex size-8 shrink-0 items-center justify-center rounded-full bg-avatar text-[0.8125rem] leading-[1.1875rem] font-semibold text-avatar-foreground transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          trigger={initials(user.name, user.email)}
        />
      </div>
    </header>
  )
}
