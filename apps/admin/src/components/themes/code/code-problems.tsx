'use client'

import type { CodeProblem } from '@commerce/core/theme-code'
import { CircleAlert } from '@commerce/ui/icons'
import { themeCodeContent } from '@/data/theme-code'
import { useCopy } from '@/hooks/use-copy'

type CodeProblemsProps = {
  path: string
  problems: readonly CodeProblem[]
  onJump: (line: number) => void
}

/** Problems (Figma 699:94380): one row per problem; a row jumps to its line. */
export default function CodeProblems({ path, problems, onJump }: CodeProblemsProps) {
  // Hooks
  const copy = useCopy(themeCodeContent.problems)

  // Early returns
  if (!problems.length) return null

  // Render logic
  return (
    <section aria-label={copy.heading} className="shrink-0 border-t border-border bg-card">
      <h2 className="flex h-9 items-center gap-2 px-4 font-mono text-caption tracking-wide text-muted-foreground uppercase">
        {copy.heading}
        <span className="rounded border border-danger-border px-1.5 text-destructive">
          {problems.length}
        </span>
      </h2>
      <ul>
        {problems.map((p) => (
          <li key={`${p.line}:${p.column}`}>
            <button
              type="button"
              onClick={() => onJump(p.line)}
              className="flex h-8 w-full items-center gap-3 px-4 text-left text-body transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CircleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate text-foreground">{p.message}</span>
              <span className="font-mono text-caption text-muted-foreground">
                {path} {p.line}:{p.column}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
