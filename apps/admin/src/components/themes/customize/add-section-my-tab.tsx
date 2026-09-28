'use client'

import type { CustomSection } from '@commerce/core/theme'
import { Bookmark, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Image from 'next/image'
import { toast } from 'sonner'
import { customizeContent } from '@/data/customize'
import {
  CHROME_FOCUS,
  CHROME_META,
  CHROME_ROW_HOVER,
  CHROME_TRANSITION,
} from '@/lib/customize-chrome'
import { deleteMySection, useMySections } from '@/lib/customize-my-sections'
import SectionIcon from './section-icon'

type MySectionsTabProps = {
  query: string
  onAdd: (section: CustomSection) => void
}

const copy = customizeContent.mySections

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

/**
 * The Add panel's "My sections" tab: the store's saved sections, newest
 * first. Clicking one adds a fresh copy (new ids) where the panel was opened.
 */
export default function MySectionsTab({ query, onAdd }: MySectionsTabProps) {
  // Hooks
  const { status, items } = useMySections()

  // Event handlers
  const handleDelete = async (section: CustomSection) => {
    try {
      await deleteMySection(section.id)
      toast.success(copy.removed)
    } catch {
      toast.error(copy.removeFailed)
    }
  }

  // Early returns
  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex justify-center py-10 text-muted-foreground">
        <Spinner />
      </div>
    )
  }
  if (status === 'error' && items.length === 0) {
    return <p className="px-4 py-10 text-center text-xs text-muted-foreground">{copy.loadFailed}</p>
  }
  const needle = query.trim().toLowerCase()
  const shown = needle ? items.filter((s) => s.name.toLowerCase().includes(needle)) : items
  if (shown.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Bookmark aria-hidden className="size-4" />
        </span>
        <p className="text-[0.8125rem] font-medium text-foreground">{copy.empty}</p>
        <p className="text-xs text-muted-foreground">{copy.emptyHint}</p>
      </div>
    )
  }

  // Render logic
  return (
    <ul className="flex flex-col gap-0.5 pt-1">
      {shown.map((section) => (
        <li key={section.id} className="group/mine relative">
          <button
            type="button"
            onClick={() => onAdd(section)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 pr-9 text-left',
              CHROME_ROW_HOVER,
              CHROME_TRANSITION,
              CHROME_FOCUS,
            )}
          >
            {section.thumbnail ? (
              <span className="relative size-7 shrink-0 overflow-hidden rounded-lg ring-1 ring-border">
                <Image
                  src={section.thumbnail}
                  alt=""
                  fill
                  sizes="1.75rem"
                  className="object-cover"
                />
              </span>
            ) : (
              <SectionIcon type={section.block.type} tile="md" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[0.8125rem] leading-5 font-medium text-foreground">
                {section.name}
              </span>
              <span className={cn('truncate', CHROME_META)}>
                {copy.savedOn(dateLabel(section.createdAt))}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleDelete(section)}
            aria-label={copy.remove(section.name)}
            title={copy.remove(section.name)}
            className={cn(
              'absolute top-1/2 right-1.5 hidden size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground group-focus-within/mine:flex group-hover/mine:flex hover:bg-muted hover:text-destructive',
              CHROME_FOCUS,
            )}
          >
            <Trash2 aria-hidden className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
