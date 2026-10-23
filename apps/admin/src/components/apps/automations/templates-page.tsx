'use client'

import {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TemplateView,
  walkNodes,
} from '@commerce/core/automations'
import { Eye, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import SectionHead from '@/components/layout/section-head'
import { automationPiecesContent, automationsContent } from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import { triggerLabel } from '@/lib/automation-labels'
import { automationRoutes } from '@/lib/automation-routes'
import DevMockNotice from './dev-mock-notice'
import TemplatePreviewDialog from './template-preview-dialog'
import TriggerPickerDialog from './trigger-picker-dialog'

type Category = (typeof TEMPLATE_CATEGORIES)[number] | 'all'

/** The template gallery: prefilled workflows by category, each previewed on the canvas and copied with one click. */
export default function TemplatesPage() {
  // Hooks
  const all = useCopy(automationsContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const router = useRouter()
  const catalogue = useAutomationCatalogue()
  const [templates, setTemplates] = useState<TemplateView[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [category, setCategory] = useState<Category>('all')
  const [previewing, setPreviewing] = useState<TemplateView | null>(null)
  const [blank, setBlank] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    automationApi
      .templates()
      .then((t) => live && setTemplates(t))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const nameOf = (t: TemplateView) => t.name ?? (t.nameKey ? pieces[t.nameKey] : undefined) ?? t.id
  const descriptionOf = (t: TemplateView) =>
    t.description ?? (t.descriptionKey ? pieces[t.descriptionKey] : undefined) ?? ''
  const definitionOf = (t: TemplateView) =>
    BUILTIN_TEMPLATES.find((b) => b.id === t.id)?.definition ?? null

  // Event handlers
  const handleCreate = async (
    input: { templateId: string; name: string } | { triggerType: string; name: string },
  ) => {
    setBusy(true)
    try {
      const w = await automationApi.create(input)
      toast.success(copy.created)
      router.push(automationRoutes.workflow(w.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      setBusy(false)
    }
  }

  // Early returns
  if (failed) return <EmptyState variant="page" tone="danger" body={all.loadFailed} />

  // Render logic
  const copy = all.templates
  const used = TEMPLATE_CATEGORIES.filter((c) => templates?.some((t) => t.category === c))
  const shown = (templates ?? []).filter((t) => category === 'all' || t.category === category)

  return (
    <div className="flex flex-col gap-4">
      <DevMockNotice />
      <SectionHead
        title={copy.title}
        intro={copy.intro}
        action={
          <Button variant="outline" disabled={!catalogue} onClick={() => setBlank(true)}>
            <Plus aria-hidden="true" />
            {copy.blank}
          </Button>
        }
      />
      <PillTabs
        variant="underline"
        value={category}
        onChange={setCategory}
        tabs={[
          { value: 'all' as Category, label: copy.all },
          ...used.map((c) => ({ value: c as Category, label: copy.categories[c] ?? c })),
        ]}
      />
      {templates === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const def = definitionOf(t)
            const trigger = catalogue?.triggers.find((x) => x.id === t.triggerType) ?? null
            return (
              <li key={t.id}>
                <Card gap={4} inset={4} className="h-full justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-body-strong text-ink-strong">{nameOf(t)}</h3>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {copy.categories[t.category] ?? t.category}
                      </span>
                    </div>
                    <p className="text-caption text-muted-foreground">{descriptionOf(t)}</p>
                    <p className="text-caption text-muted-foreground">
                      {copy.startsWith}: {triggerLabel(pieces, locale, trigger, t.triggerType)}
                      {def ? ` · ${copy.steps(walkNodes(def).length)}` : ''}
                    </p>
                    {t.available ? null : (
                      <p className="text-caption text-danger">{copy.requiresApp}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {def && catalogue ? (
                      <Button variant="ghost" size="sm" onClick={() => setPreviewing(t)}>
                        <Eye aria-hidden="true" />
                        {copy.preview}
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy || !t.available}
                      onClick={() => void handleCreate({ templateId: t.id, name: nameOf(t) })}
                    >
                      {copy.use}
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      {catalogue && previewing ? (
        <TemplatePreviewDialog
          open
          onOpenChange={(open) => !open && setPreviewing(null)}
          name={nameOf(previewing)}
          description={descriptionOf(previewing)}
          definition={definitionOf(previewing)}
          catalogue={catalogue}
          busy={busy}
          onUse={() => void handleCreate({ templateId: previewing.id, name: nameOf(previewing) })}
        />
      ) : null}
      {catalogue ? (
        <TriggerPickerDialog
          open={blank}
          onOpenChange={setBlank}
          catalogue={catalogue}
          title={all.create.title}
          description={all.create.body}
          onPick={(t) => {
            setBlank(false)
            void handleCreate({ triggerType: t.id, name: all.create.untitled })
          }}
        />
      ) : null}
    </div>
  )
}
