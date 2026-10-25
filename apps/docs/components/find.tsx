import type { ReactNode } from 'react'

type FindProps = {
  where: ReactNode
  todo: ReactNode
  see: ReactNode
}

const labels = ['Where to find it', 'What to do', "What you'll see"] as const

/**
 * The "Where to find it, what to do, what you'll see" pattern as three numbered steps in one
 * rounded card. Use it at the top of a how-to: `<Find where="..." todo="..." see="..." />`.
 */
export default function Find({ where, todo, see }: FindProps) {
  const values = [where, todo, see]

  return (
    <ol className="docs-find not-prose my-5 grid list-none gap-0 p-0 sm:grid-cols-3">
      {labels.map((label, index) => (
        <li
          key={label}
          className="flex flex-col gap-1.5 border-(--docs-border) p-4 not-first:border-t sm:not-first:border-t-0 sm:not-first:border-l"
        >
          <span className="docs-find-label flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-(--docs-accent-bg) text-[0.6875rem] font-semibold text-(--docs-link)">
              {index + 1}
            </span>
            {label}
          </span>
          <span className="text-[0.9375rem] leading-relaxed text-(--docs-fg)">{values[index]}</span>
        </li>
      ))}
    </ol>
  )
}
