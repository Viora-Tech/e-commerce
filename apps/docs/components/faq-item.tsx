import { Plus } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'

type FaqItemProps = {
  question: string
  children: ReactNode
}

/**
 * One question in a `<Faq>` accordion: a native `<details>`, so it opens without JavaScript
 * and Pagefind indexes the answer. Hairline rows with a plus that turns into a cross when open.
 */
export default function FaqItem({ question, children }: FaqItemProps) {
  return (
    <details className="group border-b border-(--docs-border)">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[0.9375rem] font-medium text-(--docs-fg) transition-colors hover:text-(--docs-link) [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <Plus
          size={16}
          weight="regular"
          aria-hidden="true"
          className="shrink-0 text-(--docs-muted) transition-transform duration-200 group-open:rotate-45"
        />
      </summary>
      <div className="pb-4 text-[0.9375rem] text-(--docs-muted) [&>:first-child]:mt-0 [&>p]:leading-relaxed">
        {children}
      </div>
    </details>
  )
}
