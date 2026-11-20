'use client'

import type { AgentCheck, AgentReadinessReport } from '@commerce/core/agent-readiness'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button, buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { agentReadinessContent } from '@/data/agent-readiness'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Copy = typeof agentReadinessContent

/** Where a failed check is fixed; null when there is nothing for the merchant to change. */
function fixLink(check: AgentCheck): { href: string; external: boolean } | null {
  switch (check.id) {
    case 'bots_allowed':
      return { href: 'https://dash.cloudflare.com/', external: true }
    case 'robots_allows_ai':
    case 'llms_txt':
    case 'sitemap_products':
    case 'mcp_endpoint':
      return { href: routes.onlineStore.preferences(), external: false }
    case 'product_data':
    case 'product_variants':
    case 'price_tags':
      return { href: routes.onlineStore.themes(), external: false }
    case 'products_have_sku':
      return { href: `${routes.products.list()}?status=active`, external: false }
    case 'markdown_copy':
    case 'product_feed':
      return null
  }
}

/** The plain fix line for a failed check, in the member's language. */
function fixText(check: AgentCheck, copy: Copy): string {
  const c = copy.checks
  switch (check.id) {
    case 'bots_allowed':
      return c.bots_allowed.fix((check.names ?? []).join(', '))
    case 'robots_allows_ai':
      return c.robots_allows_ai.fix((check.names ?? []).join(', '))
    case 'products_have_sku':
      return c.products_have_sku.fix(check.count ?? 0)
    default:
      return c[check.id].fix()
  }
}

/** Settings → Store health › AI shopping agents: run the live-site check, each line pass or fix. */
export default function AgentReadinessCard() {
  // Hooks
  const copy = useCopy(agentReadinessContent)
  const fmt = useFormat()
  const [report, setReport] = useState<AgentReadinessReport | null | undefined>(undefined)
  const [checking, setChecking] = useState(false)
  const [failed, setFailed] = useState(false)

  // Event handlers
  const handleRun = async () => {
    setChecking(true)
    setFailed(false)
    try {
      setReport(await api.seo.agentReadiness())
    } catch {
      setFailed(true)
    } finally {
      setChecking(false)
    }
  }

  // Render logic
  return (
    <SettingsCard>
      <header className="mb-4 flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="text-body font-semibold text-ink-strong">{copy.title}</h2>
          <p className="text-caption text-muted-foreground">{copy.intro}</p>
          {report ? (
            <p className="text-caption text-muted-foreground">
              {copy.passed(report.passed, report.checks.length)} ·{' '}
              {copy.checked(fmt.dateTime(report.checkedAt))}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={handleRun} disabled={checking}>
          {checking ? copy.running : copy.run}
        </Button>
      </header>
      {failed ? <p className="text-body text-danger">{copy.failed}</p> : null}
      {report === null ? <p className="text-body text-muted-foreground">{copy.noDomain}</p> : null}
      {report ? (
        <ul className="flex flex-col">
          {report.checks.map((check) => {
            const link = check.pass ? null : fixLink(check)
            return (
              <li
                key={check.id}
                className="flex flex-col gap-2 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={check.pass ? 'success' : 'attention'}>
                      {check.pass ? copy.pass : copy.fail}
                    </StatusChip>
                    <p className="text-body font-semibold break-words text-ink-strong">
                      {copy.checks[check.id].title}
                    </p>
                  </div>
                  {check.pass ? null : (
                    <p className="text-caption text-muted-foreground">{fixText(check, copy)}</p>
                  )}
                </div>
                {link ? (
                  <Link
                    href={link.href}
                    {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'shrink-0 self-start sm:self-center',
                    )}
                  >
                    {copy.open}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </SettingsCard>
  )
}
