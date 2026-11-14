'use client'

import type { WorkflowSummary } from '@commerce/core/automations'
import { Copy, Pencil, Trash2 } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { automationsContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import { automationRoutes } from '@/lib/automation-routes'

type WorkflowRowMenuProps = {
  workflow: WorkflowSummary
  /** Reloads the list after a change. */
  onChanged: () => void
}

const messageOf = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/** The ⋯ menu on a workflow row: edit, duplicate, pause or activate, delete. */
export default function WorkflowRowMenu({ workflow, onChanged }: WorkflowRowMenuProps) {
  // Hooks
  const { list } = useCopy(automationsContent)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleDuplicate = async () => {
    try {
      const copy = await automationApi.duplicate(workflow.id)
      toast.success(list.row.duplicated)
      router.push(automationRoutes.workflow(copy.id))
    } catch (err) {
      toast.error(messageOf(err, list.row.failed))
    }
  }

  const handleStatus = async (status: 'on' | 'off') => {
    try {
      // Waiting runs finish; the editor's Pause asks first when there are any.
      await automationApi.setStatus({ id: workflow.id, status, waitingRuns: 'finish' })
      toast.success(status === 'on' ? list.row.activated : list.row.paused)
      onChanged()
    } catch (err) {
      toast.error(messageOf(err, list.row.failed))
    }
  }

  const handleDelete = async () => {
    try {
      await automationApi.delete(workflow.id)
      toast.success(list.row.deleted)
      onChanged()
    } catch (err) {
      toast.error(messageOf(err, list.row.failed))
      throw err
    }
  }

  // Render logic
  const on = workflow.status === 'on'
  const neverPublished = workflow.publishedVersion === null

  return (
    <>
      <RowMenu
        items={[
          { label: list.row.edit, icon: Pencil, href: automationRoutes.workflow(workflow.id) },
          { label: list.row.duplicate, icon: Copy, onSelect: () => void handleDuplicate() },
          on
            ? { label: list.row.pause, onSelect: () => void handleStatus('off') }
            : {
                label: neverPublished ? list.row.neverPublished : list.row.activate,
                disabled: neverPublished,
                onSelect: () => void handleStatus('on'),
              },
          {
            label: list.row.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        tone="destructive"
        open={deleting}
        onOpenChange={setDeleting}
        title={list.row.deleteTitle(workflow.name)}
        body={list.row.deleteBody}
        confirmLabel={list.row.deleteConfirm}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
