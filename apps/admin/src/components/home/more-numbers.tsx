import { ChevronDown } from '@commerce/ui/icons'
import type { ReactNode } from 'react'
import { homePageContent } from '@/data/home'
import { getCopy } from '@/lib/copy-server'

type MoreNumbersProps = {
  children: ReactNode
}

/**
 * "More numbers": the charts that are not in the Home design (sales over time, top products,
 * payments, states, the hours heatmap, the monthly goal) kept one click away, collapsed.
 */
export default async function MoreNumbers({ children }: MoreNumbersProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).more

  return (
    <details className="group flex flex-col gap-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col">
          <span className="text-card-title text-ink-strong">{c.title}</span>
          <span className="text-caption font-normal text-muted-foreground">{c.subtitle}</span>
        </span>
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform duration-150 ease-out group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </details>
  )
}
