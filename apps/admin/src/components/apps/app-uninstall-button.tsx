'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type AppUninstallButtonProps = { appId: string; name: string }

/** The installed app's "more" menu: Uninstall, with the same confirmation as the Apps list. */
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
        items={[{ label: copy.uninstall, destructive: true, onSelect: () => setAsking(true) }]}
      />
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.confirmUninstall.title(name)}</AlertDialogTitle>
            <AlertDialogDescription>{copy.confirmUninstall.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.confirmUninstall.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirm()}>
              {copy.confirmUninstall.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
