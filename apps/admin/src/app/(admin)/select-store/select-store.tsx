'use client'

import { ArrowRight, Loader2Icon, Plus, Store } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { authContent } from '@/data/auth'
import { authClient } from '@/lib/auth-client'

type StoreOption = { id: string; name: string; slug: string }

type SelectStoreProps = {
  stores: StoreOption[]
  /** When true and the member belongs to exactly one store, pick it immediately instead of
   *  waiting for a click - used by the layout's "no active store" fallback. */
  autoSelect?: boolean
}

const copy = authContent.selectStore

/** Sets the active organization and lands on the dashboard; on failure, surfaces the error and
 *  lets the caller re-enable its controls. Module-scope so both the auto-select effect and the
 *  click handler share one implementation without one calling the other out of hook order. */
async function pickStore(id: string, setBusyId: (id: string | null) => void) {
  setBusyId(id)
  try {
    const { error } = await authClient.organization.setActive({ organizationId: id })
    if (error) throw new Error(error.message ?? copy.switchFailed)
    // A full load, so client caches (permissions, lists) start fresh for the new store.
    window.location.assign('/')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : copy.switchFailed)
    setBusyId(null)
  }
}

export default function SelectStore({ stores, autoSelect = false }: SelectStoreProps) {
  // Hooks
  const [busyId, setBusyId] = useState<string | null>(null)
  const autoPicked = useRef(false)
  useEffect(() => {
    // A single store and no active one yet: pick it without waiting for a click.
    const soleStoreId = autoSelect && stores.length === 1 ? (stores[0]?.id ?? null) : null
    if (soleStoreId && !autoPicked.current) {
      autoPicked.current = true
      pickStore(soleStoreId, setBusyId)
    }
  }, [autoSelect, stores])

  // Event handlers
  const handlePick = (id: string) => pickStore(id, setBusyId)

  // Early returns
  if (autoSelect && stores.length === 1) {
    return (
      <PageBody width="narrow">
        <div className="flex items-center justify-center gap-2 py-16 text-body text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          {copy.opening}
        </div>
      </PageBody>
    )
  }

  return (
    <PageBody width="narrow">
      <PageHeader title={copy.title} />
      {stores.length === 0 ? (
        <Card>
          <EmptyState icon={Store} heading={copy.empty.heading} body={copy.empty.body} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {stores.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Store className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-card-title">{s.name}</span>
                  <span className="text-caption text-muted-foreground-soft">{s.slug}</span>
                </div>
                <Button type="button" disabled={busyId !== null} onClick={() => handlePick(s.id)}>
                  {busyId === s.id ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {copy.open(s.name)}
                  <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        nativeButton={false}
        render={<Link href="/onboarding" />}
      >
        <Plus />
        {copy.createAnother}
      </Button>
    </PageBody>
  )
}
