'use client'

import type { ReportCategory, ReportDefinition } from '@commerce/api'
import { ChevronRightIcon, ListTree } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SectionHead from '@/components/layout/section-head'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ReportNameDialog from './report-name-dialog'
import ReportsAsk from './reports-ask'
import SavedReportCard from './saved-report-card'

type Saved = Awaited<ReturnType<typeof api.analytics.savedReports>>[number]

type ReportsHomeProps = {
  reports: readonly ReportDefinition[]
  saved: Saved[]
  /** The AI assistant is on for this store and member. */
  assistant: boolean
}

const CATEGORIES = Object.keys(analyticsContent.reports.categories) as ReportCategory[]

/**
 * Analytics → Reports (Figma "Marketing / Reports home"): an ask box whose answers, tables and
 * charts show on this page (read-only), the reports the merchant saved, and the ready-made reports by topic.
 */
export default function ReportsHome({ reports, saved: initialSaved, assistant }: ReportsHomeProps) {
  // Hooks
  const { reports: c, query: queryCopy } = useCopy(analyticsContent)
  const [saved, setSaved] = useState(initialSaved)
  const [renaming, setRenaming] = useState<Saved | null>(null)
  const [deleting, setDeleting] = useState<Saved | null>(null)

  // Event handlers
  const handleRename = async (name: string) => {
    if (!renaming) return
    try {
      await api.analytics.renameSavedReport({ id: renaming.id, name })
      setSaved((all) => all.map((s) => (s.id === renaming.id ? { ...s, name } : s)))
      toast.success(c.saved.renamed)
      setRenaming(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  const handleDelete = async () => {
    if (!deleting) return
    try {
      await api.analytics.deleteSavedReport({ id: deleting.id })
      setSaved((all) => all.filter((s) => s.id !== deleting.id))
      toast.success(c.saved.deleted)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(null)
    }
  }

  // Render logic
  return (
    <div className="flex w-full flex-col gap-8 px-4 pt-4 pb-6 md:px-6 md:pt-5 md:pb-8">
      <div className="flex flex-col gap-6">
        <PageHeader
          title={c.title}
          summary={c.home.intro}
          actions={
            <KitButton variant="secondary" href={routes.analytics.query()}>
              <ListTree />
              {queryCopy.open}
            </KitButton>
          }
        />
        <ReportsAsk enabled={assistant} />
      </div>
      <section className="flex flex-col gap-3">
        <SectionHead title={c.saved.title} intro={c.saved.subtitle} />
        {saved.length === 0 ? (
          <p className="rounded-xl border border-border border-dashed px-5 py-6 text-body text-muted-foreground">
            {c.saved.empty}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {saved.map((s) => (
              <SavedReportCard
                key={s.id}
                saved={s}
                onRename={() => setRenaming(s)}
                onDelete={() => setDeleting(s)}
              />
            ))}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-5">
        <SectionHead title={c.templates.title} intro={c.templates.subtitle} />
        {CATEGORIES.map((category) => {
          const items = reports.filter((r) => r.category === category)
          if (items.length === 0) return null
          return (
            <div key={category} className="flex flex-col gap-3">
              <h3 className="text-body-strong text-foreground">{c.categories[category]}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((report) =>
                  report.available ? (
                    <Link key={report.slug} href={routes.analytics.report(report.slug)}>
                      <Card className="h-full gap-1 p-5 motion-press hover:shadow-card-hover">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-body-strong text-foreground">{report.title}</p>
                          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="text-caption text-muted-foreground">{report.description}</p>
                      </Card>
                    </Link>
                  ) : (
                    <Card key={report.slug} className="h-full gap-1 p-5 opacity-60">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-strong text-foreground">{report.title}</p>
                        <span className="shrink-0 text-caption text-muted-foreground">
                          {c.soon}
                        </span>
                      </div>
                      <p className="text-caption text-muted-foreground">{report.description}</p>
                      {report.missing ? (
                        <p className="mt-1 text-caption text-muted-foreground">{report.missing}</p>
                      ) : null}
                    </Card>
                  ),
                )}
              </div>
            </div>
          )
        })}
      </section>
      {renaming ? (
        <ReportNameDialog
          title={c.rename.title}
          confirm={c.rename.confirm}
          initialName={renaming.name}
          onCancel={() => setRenaming(null)}
          onConfirm={handleRename}
        />
      ) : null}
      <ConfirmDialog
        tone="destructive"
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={c.remove.title(deleting?.name ?? '')}
        body={c.remove.body}
        confirmLabel={c.remove.confirm}
        cancelLabel={c.remove.cancel}
        onConfirm={handleDelete}
      />
    </div>
  )
}
