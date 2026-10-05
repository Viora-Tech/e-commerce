'use client'

import type { PreflightCheck } from '@commerce/plugin-shopify-import/client'
import { CircleAlert, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'

type PreflightCardProps = {
  checks: PreflightCheck[]
}

const keyOf = (c: PreflightCheck) => `${c.id}-${c.resource ?? 'all'}`

/** "Before you import": the warnings and blocks for what was chosen, each with where to fix it. */
export default function PreflightCard({ checks }: PreflightCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.preflight)
  const resources = useCopy(shopifyImportContent.resources)

  // Early returns
  const shown = checks.filter((c) => c.status !== 'ok')
  if (shown.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {shown.map((c) => (
            <li key={keyOf(c)} className="flex items-start gap-3">
              {c.status === 'block' ? (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-medium text-ink-strong">
                  {copy.checks[c.id].title}
                  {c.resource ? `: ${resources[c.resource]}` : null}
                </span>
                <span className="text-caption text-muted-foreground">
                  {copy.checks[c.id].help}
                  {c.detail ? ` (${c.detail})` : ''}
                </span>
                {c.status === 'block' ? (
                  <span className="text-caption text-destructive">{copy.blocked}</span>
                ) : null}
              </div>
              {c.fixHref ? (
                <Button variant="outline" size="sm" render={<Link href={c.fixHref} />}>
                  {copy.fix}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
