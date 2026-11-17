'use client'

import type { AgentProduct } from '@commerce/core'
import { Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import { agentReadyContent } from '@/data/agent-knowledge'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/**
 * "Test a query", after Shopify's: a shopper's search run through the same code the store's
 * agent endpoint uses, so the merchant sees which products an agent gets, in order.
 */
export default function AgentTestQuery() {
  // Hooks
  const copy = useCopy(agentReadyContent.test)
  const format = useFormat()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ q: string; products: AgentProduct[] } | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    setBusy(true)
    setError(false)
    try {
      setResult({ q, products: await api.salesChannels.testQuery({ query: q }) })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label={copy.label}
            placeholder={copy.placeholder}
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" disabled={busy || query.trim().length < 2}>
          {copy.run}
        </Button>
      </form>
      {error ? <p className="mt-3 text-caption text-destructive">{copy.failed}</p> : null}
      {result ? (
        result.products.length ? (
          <>
            <ol className="mt-4 flex flex-col divide-y divide-border">
              {result.products.map((p, i) => (
                <li key={p.url} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-caption text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  {p.image ? (
                    // biome-ignore lint/performance/noImgElement: a remote catalog thumbnail, as agents receive it
                    <img
                      src={p.image}
                      alt=""
                      className="size-10 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span className="size-10 shrink-0 rounded-md bg-muted" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-body font-medium text-foreground hover:underline"
                    >
                      {p.title}
                    </a>
                    <span className="truncate text-caption text-muted-foreground">{p.brand}</span>
                  </span>
                  <span className="shrink-0 text-right text-body tabular-nums">
                    {format.moneyWhole(Math.round(Number(p.priceRange.min) * 100))}
                    {p.available ? null : (
                      <span className="block text-caption text-muted-foreground">
                        {copy.soldOut}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-caption text-muted-foreground">{copy.note}</p>
          </>
        ) : (
          <p className="mt-4 text-body text-muted-foreground">{copy.empty(result.q)}</p>
        )
      ) : null}
    </DataCard>
  )
}
