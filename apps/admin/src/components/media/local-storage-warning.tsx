import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import HealthLine from '@/components/settings/health-line'
import { storageWarningContent } from '@/data/storage-warning'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

/** Cloud providers that keep files outside the app container. */
const CLOUD = new Set(['r2', 's3'])

/**
 * A red notice while a production store keeps uploads on the container's own disk: every
 * redeploy starts a fresh container and the files are gone (#298, #300), and the storefront
 * container cannot read the admin's disk anyway. Hidden in development, where the local
 * folder is fine, and for members who cannot read settings.
 */
export default async function LocalStorageWarning() {
  // Early returns
  if (process.env.NODE_ENV !== 'production') return null
  const context = await serverContext()
  const storage = await call(appRouter.store.getStorage, undefined, { context }).catch(() => null)
  if (!storage) return null
  if (storage.settings.enabled.some((id) => CLOUD.has(id))) return null

  // Render logic
  const copy = await getCopy(storageWarningContent)
  return (
    <HealthLine
      tone="bad"
      title={copy.title}
      help={copy.body}
      action={
        <Button nativeButton={false} render={<Link href={routes.content.storage()} />}>
          {copy.action}
        </Button>
      }
    />
  )
}
