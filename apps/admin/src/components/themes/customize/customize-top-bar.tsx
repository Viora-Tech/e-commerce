'use client'

import { ArrowLeft, MoreHorizontal } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
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
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'

type CustomizeTopBarProps = {
  name: string
  live: boolean
  dirty: boolean
  saving: boolean
  publishing: boolean
  canPublish: boolean
  /** Template and resource pickers. */
  pickers: ReactNode
  onDiscard: () => void
  onSave: () => void
  onPublish: () => void
}

const copy = customizeContent.bar
const editor = themesContent.editor

/** Customize's bar: back, theme, template picker, Save and the Discard/Publish menu. */
export default function CustomizeTopBar({
  name,
  live,
  dirty,
  saving,
  publishing,
  canPublish,
  pickers,
  onDiscard,
  onSave,
  onPublish,
}: CustomizeTopBarProps) {
  // Render logic
  return (
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-3">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg"
          aria-label={editor.back}
          title={editor.back}
          nativeButton={false}
          render={<Link href="/online-store/themes" />}
        >
          <ArrowLeft aria-hidden className="size-4" />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-[0.8125rem] leading-5 font-semibold tracking-tight text-foreground">
            {name}
          </h1>
          <Badge variant={live ? 'success' : 'neutral'}>{live ? editor.live : editor.draft}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">{pickers}</div>
      <div className="flex items-center justify-end gap-3">
        <span
          role="status"
          className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          aria-live="polite"
        >
          {dirty ? (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
          ) : null}
          {dirty ? copy.unsaved : copy.upToDate}
        </span>
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
        <Button
          variant="default"
          className="rounded-lg"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? <Spinner /> : null}
          {copy.save}
        </Button>
      </div>
    </header>
  )
}
