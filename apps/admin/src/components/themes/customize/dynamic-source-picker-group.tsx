'use client'

import { CheckIcon, ChevronRight, Database, Folder, ShoppingBag, Store } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { dynamicSourcePickerContent } from '@/data/dynamic-sources'
import { useCopy } from '@/hooks/use-copy'
import {
  type SourceRow,
  type SourceSection,
  type SourceSectionKind,
  sectionSize,
} from '@/lib/dynamic-source-groups'
import DynamicSourceMatch from './dynamic-source-match'

type DynamicSourcePickerGroupProps = {
  section: SourceSection
  open: boolean
  query: string
  /** The source the setting reads now. */
  current: string | null
  /** The row the arrow keys are on. */
  active: string | null
  idOf: (path: string) => string
  onToggle: () => void
  onPick: (path: string) => void
  onHover: (path: string) => void
}

const ICONS: Record<SourceSectionKind, typeof Store> = {
  product: ShoppingBag,
  collection: Folder,
  shop: Store,
  metaobject: Database,
}

const ROW =
  'flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-body text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none'

/**
 * One source type in "Connect dynamic source": a header that folds the section,
 * then its fields as rows, or for a content type one row per entry with its
 * fields as chips (a single field makes the whole row the pick).
 */
export default function DynamicSourcePickerGroup({
  section,
  open,
  query,
  current,
  active,
  idOf,
  onToggle,
  onPick,
  onHover,
}: DynamicSourcePickerGroupProps) {
  // Hooks
  const copy = useCopy(dynamicSourcePickerContent)

  // Helpers
  const rowProps = (path: string) => ({
    id: idOf(path),
    type: 'button' as const,
    role: 'option',
    tabIndex: -1,
    'aria-selected': path === active,
    onClick: () => onPick(path),
    onMouseMove: () => path !== active && onHover(path),
  })
  const check = (path: string) =>
    path === current ? (
      <CheckIcon aria-label={copy.connected} className="size-4 shrink-0 text-primary" />
    ) : null
  const fieldRow = (row: SourceRow, entry?: string) => (
    <button
      key={row.path}
      {...rowProps(row.path)}
      className={cn(ROW, row.path === active && 'bg-muted', row.path === current && 'font-medium')}
    >
      <span className="min-w-0 flex-1 truncate">
        <DynamicSourceMatch text={entry ?? row.label} query={query} />
      </span>
      {entry ? (
        <span className="max-w-[40%] shrink-0 truncate text-caption text-muted-foreground">
          <DynamicSourceMatch text={row.label} query={query} />
        </span>
      ) : null}
      {check(row.path)}
    </button>
  )

  // Render logic
  const Icon = ICONS[section.kind]
  const bodyId = `${idOf(section.key)}-body`

  return (
    <section className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none',
            open && 'rotate-90',
          )}
        />
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon aria-hidden className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-body-strong text-foreground">
          <DynamicSourceMatch text={section.title} query={query} />
          {section.kind === 'metaobject' ? (
            <span className="ml-2 text-caption font-normal text-muted-foreground">
              {copy.contentType}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
          {copy.count(sectionSize(section))}
        </span>
      </button>
      {open ? (
        <div id={bodyId} className="flex flex-col pl-7">
          {section.rows.map((row) => fieldRow(row))}
          {section.entries.map((entry) => {
            const [only] = entry.fields
            if (only && entry.fields.length === 1) return fieldRow(only, entry.name)
            return (
              <div
                key={entry.key}
                className="flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 text-body"
              >
                <span className="w-1/3 shrink-0 truncate text-foreground">
                  <DynamicSourceMatch text={entry.name} query={query} />
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {entry.fields.map((field) => (
                    <button
                      key={field.path}
                      {...rowProps(field.path)}
                      className={cn(
                        'inline-flex h-7 max-w-full items-center gap-1 rounded-md border px-2 text-caption text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        field.path === current
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background',
                        field.path === active && 'bg-muted',
                      )}
                    >
                      <span className="truncate">
                        <DynamicSourceMatch text={field.label} query={query} />
                      </span>
                      {field.path === current ? (
                        <CheckIcon aria-label={copy.connected} className="size-3 shrink-0" />
                      ) : null}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
