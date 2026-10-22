'use client'

import { AppWindow, Trash2 } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import RowMenu from '@/components/table/row-menu'
import { automationsContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type AutomationRowMenuProps = {
  automation: { id: string; name: string; status: 'active' | 'paused' }
}

/** The ⋯ menu on an automation row: open, turn on or off, and delete. */
export default function AutomationRowMenu({ automation }: AutomationRowMenuProps) {
  // Hooks
  const copy = useCopy(automationsContent)
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  // Event handlers
  const handleStatus = async (status: 'active' | 'paused') => {
    try {
      await api.marketing.automations.setStatus({ id: automation.id, status })
      toast.success(status === 'active' ? copy.row.turnedOn : copy.row.turnedOff)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.row.failed)
    }
  }

  const handleDelete = async () => {
    try {
      await api.marketing.automations.delete({ id: automation.id })
      toast.success(copy.row.deleted)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.row.failed)
      throw err
    }
  }

  // Render logic
  const on = automation.status === 'active'

  return (
    <>
      <RowMenu
        items={[
          { label: copy.open, icon: AppWindow, href: routes.growth.automation(automation.id) },
          on
            ? { label: copy.row.turnOff, onSelect: () => handleStatus('paused') }
            : { label: copy.row.turnOn, onSelect: () => handleStatus('active') },
          {
            label: copy.row.delete,
            icon: Trash2,
            destructive: true,
            onSelect: () => setDeleting(true),
          },
        ]}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={copy.row.deleteTitle(automation.name)}
        body={copy.row.deleteBody}
        confirmLabel={copy.row.deleteConfirm}
        cancelLabel={copy.row.keep}
        stopPropagation
        onConfirm={handleDelete}
      />
    </>
  )
}
