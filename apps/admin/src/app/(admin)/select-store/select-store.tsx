'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { ArrowRight, Store } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import { authContent } from '@/data/auth'
import { authClient } from '@/lib/auth-client'

type StoreOption = { id: string; name: string; slug: string }

const copy = authContent.selectStore

export default function SelectStore({ stores }: { stores: StoreOption[] }) {
  // Hooks
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  // Event handlers
  const handlePick = async (id: string) => {
    setBusyId(id)
    await authClient.organization.setActive({ organizationId: id })
    router.push('/')
    router.refresh()
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
                  <Store className="size-5" strokeWidth={1.8} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-card-title">{s.name}</span>
                  <span className="text-caption text-muted-foreground-soft">{s.slug}</span>
                </div>
                <Button type="button" disabled={busyId !== null} onClick={() => handlePick(s.id)}>
                  {copy.open(s.name)}
                  <ArrowRight />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageBody>
  )
}
