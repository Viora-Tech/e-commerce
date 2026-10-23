'use client'

import { Copy, Download, ListTree, Pencil, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { downloadReportCsv } from '@/lib/report-csv'
import { routes } from '@/lib/routes'
import ReportNameDialog from '../report-name-dialog'
import type { Ran } from './use-query-runner'

type QueryHeaderProps = {
  /** The saved report's name as edited (unsaved until Save), or null for a new query. */
  name: string | null
  ran: Ran | null
  /** Saves a new report (also "Save as new" on a saved one); false keeps the dialog open. */
  onSaveNew: (name: string) => Promise<boolean>
  /** Renames the saved query locally; Save in the bar stores it. */
  onRename: (name: string) => void
  onDelete: () => Promise<void>
}

type Dialog = 'save' | 'saveAs' | 'rename' | 'delete' | null

const fileName = (name: string | null) =>
  `${
    (name ?? 'custom-query')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'custom-query'
  }.csv`

/** The custom query page's title and actions: export, save as a report, rename, delete. */
export default function QueryHeader({
  name,
  ran,
  onSaveNew,
  onRename,
  onDelete,
}: QueryHeaderProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const { rename } = useCopy(analyticsContent.reports)
  const [dialog, setDialog] = useState<Dialog>(null)

  // Event handlers
  const handleSaveNew = async (next: string) => {
    if (await onSaveNew(next)) setDialog(null)
  }

  const handleRename = async (next: string) => {
    onRename(next)
    setDialog(null)
  }

  const handleDelete = async () => {
    await onDelete()
    setDialog(null)
  }

  // Render logic
  const saved = name !== null

  return (
    <>
      <PageHeader
        title={name ?? copy.title}
        summary={copy.summary}
        back={{ label: copy.back, href: routes.analytics.reports() }}
        lead={{ kind: 'icon', node: <ListTree aria-hidden="true" /> }}
        actions={
          <>
            {saved ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={rename.title}
                  onClick={() => setDialog('rename')}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={copy.save.delete}
                  onClick={() => setDialog('delete')}
                >
                  <Trash2 />
                </Button>
              </>
            ) : null}
            {ran ? (
              <Button
                variant="outline"
                onClick={() => downloadReportCsv(fileName(name), ran.report, ran.result)}
              >
                <Download />
                {copy.export}
              </Button>
            ) : null}
            {saved ? (
              <Button variant="outline" onClick={() => setDialog('saveAs')}>
                <Copy />
                {copy.save.saveAs}
              </Button>
            ) : (
              <Button onClick={() => setDialog('save')}>
                <Save />
                {copy.save.button}
              </Button>
            )}
          </>
        }
      />
      {dialog === 'save' || dialog === 'saveAs' ? (
        <ReportNameDialog
          title={copy.save.title}
          description={copy.save.help}
          confirm={copy.save.confirm}
          initialName={dialog === 'saveAs' && name ? copy.save.copyName(name) : ''}
          onCancel={() => setDialog(null)}
          onConfirm={handleSaveNew}
        />
      ) : null}
      {dialog === 'rename' && name ? (
        <ReportNameDialog
          title={rename.title}
          confirm={rename.confirm}
          initialName={name}
          onCancel={() => setDialog(null)}
          onConfirm={handleRename}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={copy.save.deleteTitle(name ?? '')}
        body={copy.save.deleteBody}
        confirmLabel={copy.save.delete}
        cancelLabel={copy.save.cancel}
        tone="destructive"
        onConfirm={handleDelete}
      />
    </>
  )
}
