'use client'

import { InfoIcon } from '@commerce/ui/icons'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'

/** "What AI apps can do": the three kinds of tools, the read/write/sensitive/never rules. */
export default function McpCapabilities() {
  // Hooks
  const copy = useCopy(mcpContent)

  // Render logic
  const c = copy.guide.capabilities

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-5">
      <span className="text-body font-semibold text-ink-strong">{c.heading}</span>
      <ul className="grid gap-3 md:grid-cols-3">
        {c.tools.map((t) => (
          <li key={t.title} className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
            <span className="text-body text-ink-strong">{t.title}</span>
            <span className="text-caption text-muted-foreground">{t.body}</span>
          </li>
        ))}
      </ul>
      <dl className="grid gap-x-4 gap-y-2 text-body sm:grid-cols-[auto_1fr]">
        {c.rules.map((r) => (
          <div key={r.title} className="contents">
            <dt className="font-medium text-ink-strong">{r.title}</dt>
            <dd className="text-muted-foreground">{r.body}</dd>
          </div>
        ))}
      </dl>
      <p className="flex items-start gap-2 text-caption text-muted-foreground">
        <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {c.reconnect}
      </p>
    </div>
  )
}
