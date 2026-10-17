'use client'

import {
  Braces,
  ChevronRight,
  FileText,
  Folder,
  ImageIcon,
  Lock,
  Plus,
  SquareTerminal,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'
import {
  type CodeFileEntry,
  codeFileName,
  codeFolders,
  libraryPath,
  sectionTypeSlug,
} from '@/lib/theme-code'

type CodeFileTreeProps = {
  files: readonly CodeFileEntry[]
  /** Native themes: library section types, shown locked under "Koomerce library". */
  library: readonly string[]
  active: string | null
  /** Paths with unsaved edits (amber dot) and with problems (red dot). */
  dirty: ReadonlySet<string>
  broken: ReadonlySet<string>
  canAdd: boolean
  onOpen: (path: string) => void
  onAdd: () => void
}

/** Library sections listed before "… N more" (Figma 699:93898). */
const LIBRARY_SHOWN = 6

const ROW =
  'flex h-[1.875rem] w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-body transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function iconFor(path: string) {
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|eot)$/i.test(path)) return ImageIcon
  if (path.endsWith('.json')) return Braces
  if (/\.(css|scss|js|mjs)$/.test(path)) return SquareTerminal
  return FileText
}

/**
 * Files (Figma 699:93624): folders that open in place, Shopify's order, the open file on a
 * soft fill, an amber dot on unsaved files and a red one on files with a problem. Native
 * themes end with the Koomerce library, locked.
 */
export default function CodeFileTree({
  files,
  library,
  active,
  dirty,
  broken,
  canAdd,
  onOpen,
  onAdd,
}: CodeFileTreeProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.files)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const [allLibrary, setAllLibrary] = useState(false)

  // Event handlers
  const handleToggle = (name: string) =>
    setClosed((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  // Helpers
  const fileRow = (path: string, label: string, locked = false) => {
    const Icon = locked ? Lock : iconFor(path)
    const selected = path === active
    return (
      <li key={path}>
        <button
          type="button"
          onClick={() => onOpen(path)}
          aria-current={selected ? 'true' : undefined}
          className={cn(
            ROW,
            'pl-9',
            selected ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {broken.has(path) ? (
            <span
              role="img"
              aria-label={copy.problem}
              className="size-1.5 rounded-full bg-destructive"
            />
          ) : dirty.has(path) ? (
            <span
              role="img"
              aria-label={copy.unsaved}
              className="size-1.5 rounded-full bg-warning"
            />
          ) : null}
        </button>
      </li>
    )
  }

  const folderHead = (name: string, label: string, open: boolean, locked = false) => (
    <button
      type="button"
      onClick={() => handleToggle(name)}
      aria-expanded={open}
      className={cn(ROW, 'text-foreground')}
    >
      <ChevronRight
        aria-hidden
        className={cn(
          'size-3.5 shrink-0 text-muted-foreground transition-transform',
          open && 'rotate-90',
        )}
      />
      {locked ? (
        <Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <Folder aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {locked ? (
        <span className="font-mono text-caption text-muted-foreground">{copy.locked}</span>
      ) : null}
    </button>
  )

  // Render logic
  const folders = codeFolders(files)
  const shownLibrary = allLibrary ? library : library.slice(0, LIBRARY_SHOWN)
  const libraryOpen = !closed.has('library')

  return (
    <nav
      aria-label={copy.heading}
      className="flex min-h-0 w-[17.5rem] shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="flex h-12 shrink-0 items-center justify-between pr-2 pl-4">
        <h2 className="text-body text-muted-foreground">{copy.heading}</h2>
        {canAdd ? (
          <button
            type="button"
            onClick={onAdd}
            aria-label={copy.add}
            title={copy.add}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <ul className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4">
        {folders.map((folder) => {
          const open = !closed.has(folder.name)
          return (
            <li key={folder.name}>
              {folderHead(folder.name, copy.folders[folder.name] ?? folder.name, open)}
              {open ? (
                <ul>{folder.files.map((f) => fileRow(f.path, codeFileName(f.path)))}</ul>
              ) : null}
            </li>
          )
        })}
        {library.length ? (
          <li>
            {folderHead('library', copy.library, libraryOpen, true)}
            {libraryOpen ? (
              <ul>
                {shownLibrary.map((type) =>
                  fileRow(libraryPath(type), sectionTypeSlug(type), true),
                )}
                {!allLibrary && library.length > LIBRARY_SHOWN ? (
                  <li>
                    <button
                      type="button"
                      onClick={() => setAllLibrary(true)}
                      className={cn(ROW, 'pl-9 text-muted-foreground hover:text-foreground')}
                    >
                      <Lock aria-hidden className="size-4 shrink-0" />
                      {copy.more(library.length - LIBRARY_SHOWN)}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
