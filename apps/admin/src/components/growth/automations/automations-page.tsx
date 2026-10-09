'use client'

import { AUTOMATION_TEMPLATES, type AutomationTemplateId } from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import { automationsContent } from '@/data/marketing-automations'
import { campaignReportContent } from '@/data/marketing-campaigns'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

type Item = Awaited<ReturnType<typeof api.marketing.automations.list>>[number]

type AutomationsPageProps = { automations: Item[] }

/** Growth > Automations: the store's automations with results, then the template gallery. */
export default function AutomationsPage({ automations }: AutomationsPageProps) {
  // Hooks
  const copy = useCopy(automationsContent)
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Event handlers
  const handleUse = async (template: AutomationTemplateId) => {
    setBusy(template)
    try {
      const row = await api.marketing.automations.create({ template })
      toast.success(copy.created)
      router.push(routes.growth.automation(row.id))
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  const used = (id: string) => automations.filter((a) => a.template === id).length
  const c = copy.columns

  return (
    <ProoflyListPage title={copy.title} summary={copy.intro}>
      <Card gap="none" inset={5}>
        <p className="text-card-title text-ink-strong">{copy.listTitle}</p>
        {automations.length === 0 ? (
          <p className="mt-4 text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>{c.name}</TableHead>
                <TableHead className="text-center">{c.status}</TableHead>
                <TableHead className="text-right">{c.runs}</TableHead>
                <TableHead className="text-right">{c.sent}</TableHead>
                <TableHead className="text-right">{c.clickRate}</TableHead>
                <TableHead className="text-right">{c.orders}</TableHead>
                <TableHead className="text-right">{c.sales}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="max-w-80 whitespace-normal">
                    <Link
                      href={routes.growth.automation(a.id)}
                      className="flex flex-col hover:underline"
                    >
                      <span className="text-body-strong">{a.name}</span>
                      <span className="text-caption text-muted-foreground">
                        {copy.triggers[a.trigger as keyof typeof copy.triggers] ?? a.trigger}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusChip>{copy.status[a.status]}</StatusChip>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(a.stats.runs)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(a.stats.sent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaignReportContent.rate(a.stats.clicked, a.stats.sent)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(a.stats.orders)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(a.stats.revenuePaise)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-card-title text-ink-strong">{copy.templatesTitle}</h2>
          <p className="text-caption text-muted-foreground">{copy.templatesIntro}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AUTOMATION_TEMPLATES.map((t) => (
            <Card key={t.id} gap={4} inset={4} className="justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body-strong">{t.name}</p>
                  <span className="text-caption text-muted-foreground">
                    {copy.templateChannels[t.id]}
                  </span>
                </div>
                <p className="text-caption text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-muted-foreground">
                  {used(t.id) ? copy.inUse(used(t.id)) : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUse(t.id)}
                  disabled={busy !== null}
                >
                  {copy.use}
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">{copy.browseNote}</p>
      </section>
    </ProoflyListPage>
  )
}
