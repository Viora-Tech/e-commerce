'use client'

import { LayoutGrid, Trash2 } from '@commerce/ui/icons'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type AppUninstallButtonProps = { appId: string; name: string }

/** The installed app's "more" menu (Figma "App more menu"): back to every installed app, and Uninstall with the list's confirmation. */
export default function AppUninstallButton({ appId, name }: AppUninstallButtonProps) {
  // Hooks
  const copy = useCopy(appsContent)
  const router = useRouter()
  const [asking, setAsking] = useState(false)

  // Event handlers
  const handleConfirm = async () => {
    setAsking(false)
    try {
      await api.apps.uninstall({ id: appId })
      toast.success(copy.uninstalledToast(name))
      router.push(routes.apps.list())
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.actionFailed)
    }
  }

  return (
    <>
      <ActionMenu
        label={copy.gallery.kebabLabel(name)}
        trigger="kebab-vertical"
        variant="outline"
        size="md"
        items={[
          { label: copy.allInstalled, icon: LayoutGrid, href: routes.apps.list() },
          {
            label: copy.uninstall,
            icon: Trash2,
            destructive: true,
            onSelect: () => setAsking(true),
          },
        ]}
      />
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={copy.confirmUninstall.title(name)}
        body={copy.confirmUninstall.body}
        confirmLabel={copy.confirmUninstall.confirm}
        cancelLabel={copy.confirmUninstall.cancel}
        tone="default"
        onConfirm={handleConfirm}
      />
    </>
  )
}
