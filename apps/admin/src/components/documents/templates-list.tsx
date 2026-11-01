'use client'

import type { DocumentTemplateView } from '@commerce/core'
import { ExternalLink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { documentTemplatesContent } from '@/data/document-templates'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type TemplatesListProps = {
  templates: DocumentTemplateView[]
  /** The GST invoices app is installed: it owns the tax invoice. */
  gstApp: boolean
}

const GST_SETTINGS = '/apps/gst-invoices/settings'

/** Settings › Printed documents (audit #164): the three templates, each with Edit. */
export default function TemplatesList({ templates, gstApp }: TemplatesListProps) {
  // Hooks
  const copy = useCopy(documentTemplatesContent)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.meta} />
      {templates.map((t) => {
        const kind = copy.kinds[t.kind]
        return (
          <SettingsCard key={t.kind} title={kind.name} description={kind.body}>
            <div className="flex flex-col gap-3">
              {t.kind === 'invoice' && gstApp ? (
                <div className="flex flex-col gap-2 rounded-lg bg-muted px-3 py-2">
                  <p className="text-body font-medium text-foreground">{copy.gstApp.title}</p>
                  <p className="text-body text-muted-foreground">{copy.gstApp.body}</p>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={GST_SETTINGS} />}
                    >
                      <ExternalLink aria-hidden="true" />
                      {copy.gstApp.open}
                    </Button>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <StatusChip tone={t.custom ? 'info' : 'neutral'}>
                  {t.custom ? copy.custom : copy.standard}
                </StatusChip>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={routes.settings.template(t.kind)} />}
                >
                  {copy.edit}
                </Button>
              </div>
            </div>
          </SettingsCard>
        )
      })}
    </div>
  )
}
