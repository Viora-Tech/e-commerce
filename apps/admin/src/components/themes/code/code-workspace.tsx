'use client'

import { type CodeProblem, codeLanguage } from '@commerce/core/theme-code'
import { ChevronRight, ImageIcon, Lock } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useState } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import type { CodeBuffer } from '@/hooks/use-code-buffers'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { changedLines, diffChangeCount, diffLines } from '@/lib/line-diff'
import { routes } from '@/lib/routes'
import {
  caretPosition,
  codeFileName,
  codeFolderOf,
  editorText,
  sectionTypeName,
  sectionTypeSlug,
} from '@/lib/theme-code'
import CodeDiffView from './code-diff-view'
import CodeNoticePanel from './code-notice-panel'
import CodeProblems from './code-problems'
import CodeStatusBar from './code-status-bar'
import CodeTextEditor from './code-text-editor'
import type { PickedVersion } from './code-version-panel'

type CodeWorkspaceProps = {
  themeId: string
  path: string | null
  /** The open tab is a locked library section. */
  libraryType: string | null
  libraryUse: Record<string, string[]>
  buffer: CodeBuffer | undefined
  loadFailed: boolean
  problems: readonly CodeProblem[]
  /** A saved version to compare with the open file (Version history). */
  picked: PickedVersion | null
  onRetry: () => void
  onEdit: (text: string) => void
}

const CRUMB =
  'flex h-8 shrink-0 items-center gap-2 px-4 font-mono text-caption text-muted-foreground'

/**
 * Everything under the tabs: the path, then the code (or the diff with a saved version, or a
 * panel for a file that is not code here), the Problems list and the status bar.
 */
export default function CodeWorkspace({
  themeId,
  path,
  libraryType,
  libraryUse,
  buffer,
  loadFailed,
  problems,
  picked,
  onRetry,
  onEdit,
}: CodeWorkspaceProps) {
  // Hooks
  const copy = useCopy(themeCodeContent)
  const format = useFormat()
  const [caret, setCaret] = useState({ line: 1, column: 1 })
  const [jump, setJump] = useState<{ line: number; at: number } | null>(null)

  // Event handlers
  const handleCaret = (offset: number) => {
    if (buffer) setCaret(caretPosition(buffer.text, offset))
  }

  // Early returns
  if (!path) return <div className="flex-1 bg-background" />

  if (libraryType) {
    const used = libraryUse[libraryType] ?? []
    return (
      <>
        <div className={CRUMB}>
          {copy.files.library}
          <ChevronRight aria-hidden className="size-3" />
          <span className="text-foreground">{sectionTypeSlug(libraryType)}</span>
        </div>
        <CodeNoticePanel
          icon={Lock}
          title={copy.locked.title(sectionTypeName(libraryType))}
          body={copy.locked.body}
          facts={[
            used.length
              ? copy.locked.usedOn(used.map(codeFileName).join(', '))
              : copy.locked.unused,
            copy.locked.updates,
          ]}
          actions={
            <Button
              nativeButton={false}
              render={<Link href={routes.onlineStore.themeEditor(themeId)} />}
            >
              {copy.locked.openEditor}
            </Button>
          }
        />
        <CodeStatusBar items={[copy.readOnly.status, copy.bar.librarySection]} />
      </>
    )
  }

  const crumb = (
    <div className={CRUMB}>
      {codeFolderOf(path)}
      <ChevronRight aria-hidden className="size-3" />
      <span className="text-foreground">{codeFileName(path)}</span>
      {picked ? (
        <>
          <ChevronRight aria-hidden className="size-3" />
          <span className="text-foreground">
            {format.dateTime(picked.version.createdAt)} → {copy.history.now.toLowerCase()}
          </span>
        </>
      ) : null}
    </div>
  )

  if (loadFailed) {
    return (
      <>
        {crumb}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={onRetry}>
            {copy.retry}
          </Button>
        </div>
      </>
    )
  }

  if (!buffer) {
    return (
      <>
        {crumb}
        <div className="flex flex-1 flex-col gap-2 bg-background p-4" aria-busy="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </>
    )
  }

  if (!buffer.file.editable) {
    const binary = buffer.file.readOnlyReason === 'binary'
    return (
      <>
        {crumb}
        <CodeNoticePanel
          icon={binary ? ImageIcon : Lock}
          title={codeFileName(path)}
          body={binary ? copy.readOnly.binary : copy.readOnly.importSource}
          actions={
            binary ? null : (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={routes.onlineStore.themeEditor(themeId)} />}
              >
                {copy.readOnly.openEditor}
              </Button>
            )
          }
        />
        <CodeStatusBar items={[copy.readOnly.status, copy.bar.encoding]} />
      </>
    )
  }

  // Render logic
  const language = codeLanguage(path)
  const changed = changedLines(buffer.saved, buffer.text)

  if (picked) {
    const rows = diffLines(editorText(picked.body), buffer.text)
    const when = format.dateTime(picked.version.createdAt)
    return (
      <>
        {crumb}
        <CodeDiffView
          rows={rows}
          leftTitle={picked.version.createdBy ? `${when} · ${picked.version.createdBy}` : when}
          rightTitle={copy.history.current}
        />
        <CodeStatusBar
          items={[
            copy.history.comparing(when, picked.version.createdBy),
            copy.history.changes(diffChangeCount(rows)),
          ]}
        />
      </>
    )
  }

  return (
    <>
      {crumb}
      <CodeTextEditor
        fileName={codeFileName(path)}
        language={language}
        value={buffer.text}
        changed={changed}
        problems={problems}
        caretLine={caret.line}
        jump={jump}
        onChange={onEdit}
        onCaret={handleCaret}
      />
      <CodeProblems
        path={path}
        problems={problems}
        onJump={(line) => setJump({ line, at: Date.now() })}
      />
      <CodeStatusBar
        items={[
          copy.bar.languages[language],
          copy.bar.encoding,
          copy.bar.position(caret.line, caret.column),
          problems.length
            ? copy.bar.problems(problems.length)
            : changed.size
              ? copy.bar.changed(changed.size)
              : copy.bar.spaces,
        ]}
      />
    </>
  )
}
