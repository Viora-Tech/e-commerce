'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import PixelCard from '@/components/apps/pixels/pixel-card'
import PixelDialog from '@/components/apps/pixels/pixel-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import { pixelsContent } from '@/data/pixels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Pixel = Awaited<ReturnType<typeof api.pixels.list>>[number]
type Stats = Awaited<ReturnType<typeof api.pixels.stats>>

/** The Pixels app's home: the 7-day strip and one card per Meta pixel. */
export default function PixelsPage() {
  // Hooks
  const copy = useCopy(pixelsContent)
  const f = useFormat()
  const [pixels, setPixels] = useState<Pixel[] | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    Promise.all([api.pixels.list(), api.pixels.stats()]).then(([list, s]) => {
      if (cancelled) return
      setPixels(list)
      setStats(s)
    })
    return () => {
      cancelled = true
    }
  }, [reload])

  // Event handlers
  const handleChanged = () => setReload((n) => n + 1)

  // Early returns
  if (!pixels) return null

  // Render logic
  const t = copy.page.tiles

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.page.title}
        summary={copy.page.subtitle}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('pixels', 'events')} />}
            >
              {copy.page.log}
            </Button>
            <Button onClick={() => setAdding(true)}>{copy.page.add}</Button>
          </div>
        }
      />
      {stats ? (
        <StatStrip
          tiles={[
            { id: 'sent', label: t.sent, value: f.number(stats.sent), note: t.note },
            { id: 'purchases', label: t.purchases, value: f.number(stats.purchases), note: t.note },
            { id: 'failed', label: t.failed, value: f.number(stats.failed), note: t.note },
            {
              id: 'consent',
              label: t.noConsent,
              value: f.number(stats.skippedNoConsent),
              note: t.note,
            },
          ]}
        />
      ) : null}
      {pixels.length === 0 ? (
        <EmptyState
          heading={copy.page.emptyTitle}
          body={copy.page.emptyBody}
          action={<Button onClick={() => setAdding(true)}>{copy.page.add}</Button>}
        />
      ) : (
        pixels.map((p) => <PixelCard key={p.id} pixel={p} onChanged={handleChanged} />)
      )}
      <PixelDialog open={adding} onOpenChange={setAdding} pixel={null} onSaved={handleChanged} />
    </div>
  )
}
