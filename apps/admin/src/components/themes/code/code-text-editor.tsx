'use client'

import type { CodeLanguage, CodeProblem } from '@commerce/core/theme-code'
import { CircleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'
import { type CodeTone, highlightLines } from '@/lib/code-highlight'
import { lineOffset } from '@/lib/theme-code'

type CodeTextEditorProps = {
  fileName: string
  language: CodeLanguage
  value: string
  /** Lines (1-based) changed since the last save: an amber bar in the gutter. */
  changed: ReadonlySet<number>
  problems: readonly CodeProblem[]
  caretLine: number
  /** Moves the caret to this line when `jump.at` changes (the Problems list). */
  jump: { line: number; at: number } | null
  onChange: (value: string) => void
  onCaret: (offset: number) => void
}

const TONES: Record<CodeTone, string> = {
  plain: 'text-foreground',
  muted: 'text-muted-foreground',
  string: 'text-warning',
  number: 'text-violet',
  keyword: 'text-info',
  property: 'text-ink-strong',
}

/* Text and backdrop share one box model so every character sits over its colour. */
const TEXT = 'py-2 pr-8 pl-2 font-mono text-[0.8125rem] leading-5 whitespace-pre'

/**
 * The code area (Figma 699:93624): line numbers in a gutter, the text coloured line by line,
 * changed lines marked amber, a broken line red with its message at the end. A transparent
 * textarea sits over the coloured copy, so typing, selection, undo and the clipboard are the
 * browser's own. Tab indents by two spaces.
 */
export default function CodeTextEditor({
  fileName,
  language,
  value,
  changed,
  problems,
  caretLine,
  jump,
  onChange,
  onCaret,
}: CodeTextEditorProps) {
  // Hooks
  const copy = useCopy(themeCodeContent)
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = area.current
    if (!el || !jump) return
    const offset = lineOffset(el.value, jump.line)
    el.focus()
    el.setSelectionRange(offset, offset)
    el.closest('[data-code-scroll]')?.scrollTo({ top: Math.max(0, (jump.line - 6) * 20) })
  }, [jump])

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || e.shiftKey || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    // insertText keeps the browser's own undo history (setting value would wipe it).
    document.execCommand('insertText', false, '  ')
  }

  const handleSelect = () => onCaret(area.current?.selectionStart ?? 0)

  // Render logic
  const lines = highlightLines(value, language)
  const problemAt = new Map(problems.map((p) => [p.line, p]))

  return (
    <div data-code-scroll className="relative min-h-0 flex-1 overflow-auto bg-background">
      <div className="flex w-max min-w-full">
        <div
          aria-hidden
          className="sticky left-0 z-10 shrink-0 bg-background py-2 font-mono text-[0.8125rem] leading-5 select-none"
        >
          {lines.map((_, i) => {
            const no = i + 1
            return (
              <div key={no} className="relative flex h-5 items-center justify-end gap-1 pr-3 pl-5">
                {changed.has(no) ? (
                  <span className="absolute inset-y-0 left-1.5 w-0.5 rounded-full bg-warning" />
                ) : null}
                {problemAt.has(no) ? (
                  <span className="size-1.5 rounded-full bg-destructive" />
                ) : null}
                <span
                  className={cn(
                    'min-w-6 text-right tabular-nums',
                    no === caretLine ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {no}
                </span>
              </div>
            )
          })}
        </div>
        <div className="relative min-w-0 grow">
          <div aria-hidden className={cn(TEXT, 'pointer-events-none')}>
            {lines.map((tokens, i) => {
              const no = i + 1
              const problem = problemAt.get(no)
              return (
                <div
                  key={no}
                  className={cn(
                    '-ml-2 h-5 pl-2',
                    problem ? 'bg-destructive/10' : no === caretLine && 'bg-muted/60',
                  )}
                >
                  {tokens.map((t, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: tokens of one line, in order
                    <span key={j} className={TONES[t.tone]}>
                      {t.text}
                    </span>
                  ))}
                  {problem ? (
                    <span className="ml-6 inline-flex items-center gap-1.5 font-sans text-caption text-destructive">
                      <CircleAlert aria-hidden className="size-3.5" />
                      {problem.message} ({problem.line}:{problem.column}). {copy.editor.fixIt}
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
          <textarea
            ref={area}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            aria-label={copy.editor.label(fileName)}
            aria-invalid={problems.length > 0 || undefined}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            className={cn(
              TEXT,
              'absolute inset-0 size-full resize-none overflow-hidden bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25',
            )}
          />
        </div>
      </div>
    </div>
  )
}
