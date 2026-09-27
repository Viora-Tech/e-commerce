'use client'

import type { TemplateSection } from '@commerce/core/theme'
import { ChevronRight, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { type KeyboardEvent, type ReactNode, useRef, useState } from 'react'
import { customizeContent } from '@/data/customize'
import SectionIcon from './section-icon'

type SectionRowProps = {
  section: TemplateSection
  /** The name shown: the merchant's own (Rename) or the section type's label. */
  name: string
  selected: boolean
  /** Main sections and the header and footer can only move, hide and be renamed. */
  locked: boolean
  handle: ReactNode
  /** Set when the section holds blocks, so the row gets a show/hide toggle for them. */
  blocksOpen: boolean | null
  onToggleBlocks: () => void
  onSelect: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  onRename: (name: string) => void
  /** Passed this row's own element, so the caller can collapse it before dispatching. */
  onRemove: (el: HTMLElement | null) => void
}

const copy = customizeContent.tree

/**
 * One section in the tree, Shopify-style: drag handle, glyph, name, the eye
 * (always visible while hidden) and a "more" menu with Duplicate, Rename and
 * Remove. Rename swaps the name for an inline input: Enter or leaving the
 * field saves it, Escape cancels.
 */
export default function SectionRow({
  section,
  name,
  selected,
  locked,
  handle,
  blocksOpen,
  onToggleBlocks,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onRename,
  onRemove,
}: SectionRowProps) {
  // Hooks
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)
  const [menuOpen, setMenuOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Event handlers
  const handleStartRename = () => {
    setDraft(name)
    setRenaming(true)
  }

  const handleCommit = () => {
    setRenaming(false)
    if (draft.trim() !== name) onRename(draft)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCommit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setRenaming(false)
    }
  }

  // Render logic
  const hidden = section.props._hidden === true
  const eyeLabel = hidden ? copy.show(name) : copy.hide(name)

  return (
    <div
      ref={rowRef}
      className={cn(
        'group relative flex h-8 items-center gap-0.5 rounded-lg pr-1 text-[0.8125rem] transition-colors duration-150 motion-reduce:transition-none',
        selected
          ? 'bg-primary-soft font-medium text-foreground'
          : 'text-foreground/85 hover:bg-muted hover:text-foreground',
      )}
    >
      <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {handle}
      </span>
      {blocksOpen === null ? (
        <span aria-hidden className="w-4 shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onToggleBlocks}
          aria-expanded={blocksOpen}
          aria-label={blocksOpen ? copy.hideBlocks(name) : copy.showBlocks(name)}
          className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              'size-3 transition-transform duration-150 motion-reduce:transition-none',
              blocksOpen && 'rotate-90',
            )}
          />
        </button>
      )}
      {renaming ? (
        <span className="flex min-w-0 flex-1 items-center gap-2 pl-0.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-card text-primary">
            <SectionIcon type={section.type} className="size-3.5" />
          </span>
          <input
            ref={inputRef}
            // biome-ignore lint/a11y/noAutofocus: the input only exists because Rename was just chosen.
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={copy.renameLabel(name)}
            maxLength={60}
            className="h-6 min-w-0 flex-1 rounded-md border border-ring bg-card px-1.5 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={handleStartRename}
          aria-label={copy.select(name)}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 pl-0.5 text-left',
            hidden && 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md transition-colors duration-150',
              selected ? 'bg-card text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <SectionIcon type={section.type} className="size-3.5" />
          </span>
          <span className={cn('truncate', hidden && 'line-through decoration-border-strong')}>
            {name}
          </span>
        </button>
      )}
      {renaming ? null : (
        <div
          className={cn(
            // Overlays the end of the row instead of squeezing the name; the fade
            // matches the row's own background so the name slides under it.
            'absolute inset-y-0 right-1 items-center bg-linear-to-l via-70% to-transparent pl-6',
            selected ? 'from-primary-soft via-primary-soft' : 'from-muted via-muted',
            hidden || menuOpen ? 'flex' : 'hidden group-hover:flex group-focus-within:flex',
          )}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleHidden}
            aria-label={eyeLabel}
            title={eyeLabel}
          >
            {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </Button>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.more(name)}
                  title={copy.more(name)}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent
              align="start"
              side="right"
              className="min-w-40"
              // After Rename the menu hands focus to the new name input, not
              // back to its trigger (which a blur would read as "done").
              finalFocus={() => inputRef.current ?? true}
            >
              {locked ? null : (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy aria-hidden />
                  {copy.duplicateItem}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleStartRename}>
                <Pencil aria-hidden />
                {copy.rename}
              </DropdownMenuItem>
              {locked ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onRemove(rowRef.current)}>
                    <Trash2 aria-hidden />
                    {copy.removeItem}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}
