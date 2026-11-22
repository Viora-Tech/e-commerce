'use client'

import type { SeoHealthCheck, SeoHealthItem, SeoHealthReport } from '@commerce/core/seo-health'
import { ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button, buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { seoHealthContent } from '@/data/seo-health'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Copy = typeof seoHealthContent

/** Where one item is fixed: its own edit page. */
function itemHref(item: SeoHealthItem): string {
  if (item.resource === 'collection') return routes.products.collection(item.id)
  if (item.resource === 'page') return routes.onlineStore.page(item.id)
  return routes.products.detail(item.id)
}

/** The plain fix line for a failed check, in the member's language. */
function fixText(check: SeoHealthCheck, copy: Copy): string {
  const c = copy.checks
  if (check.id === 'alt_missing') return c.alt_missing.fix(check.count, check.images ?? 0)
  return c[check.id].fix(check.count)
}

/** Settings → Store health › SEO: counts of search-listing gaps, each with the items to fix. */
export default function SeoHealthCard() {
  // Hooks
  const copy = useCopy(seoHealthContent)
  const [report, setReport] = useState<SeoHealthReport | null>(null)
  const [checking, setChecking] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api.seo
      .health()
      .then(setReport)
      .catch(() => setFailed(true))
      .finally(() => setChecking(false))
  }, [])

  // Event handlers
  const handleRecheck = async () => {
    setChecking(true)
    setFailed(false)
    try {
      setReport(await api.seo.health())
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
              {copy.checkedItems(
                report.checked.product,
                report.checked.collection,
                report.checked.page,
              )}
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={handleRecheck} disabled={checking}>
          {copy.recheck}
        </Button>
      </header>
      {checking && !report ? (
        <p className="text-body text-muted-foreground">{copy.loading}</p>
      ) : null}
      {failed ? <p className="text-body text-danger">{copy.failed}</p> : null}
      {report ? (
        <ul className="flex flex-col">
          {report.checks.map((check) => {
            const pass = check.count === 0
            return (
              <li
                key={check.id}
                className="flex flex-col gap-2 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-start"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip tone={pass ? 'success' : 'attention'}>
                      {pass ? copy.pass : `${copy.fail} · ${check.count}`}
                    </StatusChip>
                    <p className="text-body font-semibold break-words text-ink-strong">
                      {copy.checks[check.id].title}
                    </p>
                  </div>
                  {pass ? null : (
                    <>
                      <p className="text-caption text-muted-foreground">{fixText(check, copy)}</p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {check.items.map((item) => (
                          <li key={`${item.resource}:${item.id}`} className="min-w-0">
                            <Link
                              href={itemHref(item)}
                              className="text-caption break-words text-primary underline-offset-2 hover:underline"
                            >
                              {item.title || copy.resource[item.resource]}
                            </Link>
                          </li>
                        ))}
                        {check.count > check.items.length ? (
                          <li className="text-caption text-muted-foreground">
                            {copy.more(check.count - check.items.length)}
                          </li>
                        ) : null}
                      </ul>
                    </>
                  )}
                </div>
                {pass ? null : (
                  <Link
                    href={routes.onlineStore.seo()}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'shrink-0 self-start',
                    )}
                  >
                    {copy.report}
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </SettingsCard>
  )
}
