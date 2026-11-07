'use client'

import { ArrowRight, CheckIcon, Loader2Icon, Store } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'
import { routes } from '@/lib/routes'

type InstallStorePickerProps = {
  appId: string
  appName: string
  stores: { id: string; name: string; slug: string }[]
  activeStoreId: string | null
  /** Stores that already have the app: choosing one opens it there. */
  installedStoreIds: string[]
}

/**
 * `/apps/install` for a member of several stores, arriving from the App Store website: pick the
 * store first, then the usual Connect, Permissions, Done flow opens in it. Switching stores is a
 * full load so every cache starts fresh for the chosen store. A store that has the app already
 * says so, and choosing it opens the app.
 */
export default function InstallStorePicker({
  appId,
  appName,
  stores,
  activeStoreId,
  installedStoreIds,
}: InstallStorePickerProps) {
  // Hooks
  const { installStore: copy } = useCopy(appsContent)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Event handlers
  const handlePick = async (id: string) => {
    setBusyId(id)
    try {
      if (id !== activeStoreId) {
        const { error } = await authClient.organization.setActive({ organizationId: id })
        if (error) throw new Error(error.message ?? copy.failed)
      }
      window.location.assign(routes.apps.install(appId, id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusyId(null)
    }
  }

  return (
    <PageBody width="narrow">
      <PageHeader title={copy.title(appName)} subtitle={copy.intro} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {stores.map((s) => {
          const installed = installedStoreIds.includes(s.id)
          return (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Store className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-card-title">{s.name}</span>
                  {installed ? (
                    <span className="flex items-center gap-1 text-caption text-muted-foreground-soft">
                      <CheckIcon className="size-3.5" />
                      {copy.installed}
                    </span>
                  ) : (
                    <span className="text-caption text-muted-foreground-soft">
                      {s.id === activeStoreId ? copy.current : s.slug}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant={installed ? 'outline' : 'default'}
                  disabled={busyId !== null}
                  onClick={() => handlePick(s.id)}
                >
                  {busyId === s.id ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {installed ? copy.openIn(s.name) : copy.choose(s.name)}
                  <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </PageBody>
  )
}
