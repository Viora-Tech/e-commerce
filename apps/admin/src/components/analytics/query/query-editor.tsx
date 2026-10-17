'use client'

import { type QuerySuggestion, suggest, wordAt } from '@commerce/core/analytics-query'
import { cn } from '@commerce/ui/lib/utils'
import { useRef, useState } from 'react'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { highlightQueryLine, type QueryTone } from '@/lib/query-highlight'

type QueryEditorProps = {
  value: string
  /** The line the last error points at, underlined in red. */
  errorLine: number | null
  onChange: (value: string) => void
  onRun: () => void
}

const TONE: Record<QueryTone, string> = {
  plain: 'text-foreground',
  keyword: 'font-semibold text-foreground',
  field: 'text-info',
  value: 'text-warning',
  comment: 'text-muted-foreground',
}
/* One line is 1.5rem (24px); the suggestion list sits under the caret's line. */
const LINE_PX = 24

/** Figma "Query editor" with "Query autocomplete": coloured text, line numbers, ⌘↵ runs. */
export default function QueryEditor({ value, errorLine, onChange, onRun }: QueryEditorProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const area = useRef<HTMLTextAreaElement>(null)
  const [caret, setCaret] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  // Helpers
  const suggestionsNow = (): QuerySuggestion[] => (open ? suggest(value, caret).slice(0, 8) : [])
  const accept = (s: QuerySuggestion) => {
    const { start } = wordAt(value, caret)
    const next = `${value.slice(0, start)}${s.value}${value.slice(caret)}`
    const at = start + s.value.length
    onChange(next)
    setOpen(false)
    requestAnimationFrame(() => {
      area.current?.setSelectionRange(at, at)
      setCaret(at)
    })
  }

  // Event handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const options = suggestionsNow()
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      setOpen(false)
      onRun()
      return
    }
    if ((e.ctrlKey && e.key === ' ') || (e.key === 'Tab' && !options.length)) {
      if (e.ctrlKey) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (!options.length) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + step + options.length) % options.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const pick = options[active]
      if (pick) accept(pick)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    setCaret(e.target.selectionStart)
    setActive(0)
    setOpen(true)
  }

  // Render logic
  const options = suggestionsNow()
  const lines = value.split('\n')
  const caretLine = value.slice(0, caret).split('\n').length

  return (
    <div className="relative flex min-h-56 font-mono text-[0.8125rem] leading-6">
      <ol
        aria-hidden="true"
        className="select-none border-border border-r px-3 py-3 text-right text-muted-foreground tabular-nums"
      >
        {lines.map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: line numbers are positions
          <li key={i}>{i + 1}</li>
        ))}
      </ol>
      <div className="relative min-w-0 flex-1">
        <pre
          aria-hidden="true"
          className="pointer-events-none m-0 whitespace-pre-wrap break-words px-3 py-3"
        >
          {lines.map((line, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: one row per source line
              key={i}
              className={cn(
                'min-h-6',
                errorLine === i + 1 && 'underline decoration-danger decoration-wavy',
              )}
            >
              {highlightQueryLine(line).map((t, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: tokens are positions in the line
                <span key={j} className={TONE[t.tone]}>
                  {t.text}
                </span>
              ))}
            </div>
          ))}
        </pre>
        <textarea
          ref={area}
          aria-label={copy.editorLabel}
          spellCheck={false}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onClick={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
          onBlur={() => setOpen(false)}
          className="absolute inset-0 resize-none whitespace-pre-wrap break-words bg-transparent px-3 py-3 text-transparent caret-foreground outline-none selection:bg-primary/25"
        />
        {options.length ? (
          <div
            role="listbox"
            aria-label={copy.suggestions}
            className="absolute left-16 z-10 w-80 overflow-hidden rounded-md border border-border bg-popover py-1 shadow-card"
            style={{ top: caretLine * LINE_PX + 14 }}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  accept(o)
                }}
                className={cn(
                  'flex cursor-pointer items-baseline gap-2 px-3 py-1',
                  i === active && 'bg-muted',
                )}
              >
                <span className="text-info">{o.value}</span>
                <span className="truncate font-sans text-caption text-muted-foreground">
                  {copy.types[o.type]} · {o.detail}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
