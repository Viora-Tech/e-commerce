'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { ArrowDown, ArrowUp, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type OptionsCardProps = {
  options: DeliveryOption[]
  onChanged: () => void
}

const APP = 'delivery-options'

/** The options shoppers pick from, in card order; a row opens its page. */
export default function OptionsCard({ options, onChanged }: OptionsCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const priceOf = (o: DeliveryOption) => {
    if (o.price.source === 'zone') return copy.options.zonePrice
    const parts = [
      o.price.markupPaise ? fmt.money(o.price.markupPaise) : null,
      o.price.markupPercent ? `${o.price.markupPercent}%` : null,
    ].filter(Boolean)
    return copy.options.routePrice(parts.length ? parts.join(' + ') : null)
  }

  // Event handlers
  const handlePreset = () => run(() => api.deliveryOptions.addPreset())
  const handleMove = (index: number, by: -1 | 1) => {
    const ids = options.map((o) => o.id)
    const [moved] = ids.splice(index, 1)
    if (!moved) return
    ids.splice(index + by, 0, moved)
    return run(() => api.deliveryOptions.reorderOptions({ ids }))
  }

  // Render logic
  const c = copy.options

  return (
    <SettingsCard
      title={c.title}
      description={c.description}
      footer={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.apps.page(APP, 'options', 'new')} />}
        >
          <Plus aria-hidden />
          {c.add}
        </Button>
      }
    >
      {options.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body text-muted-foreground">{c.empty}</p>
          <p className="text-caption text-muted-foreground">{c.presetHelp}</p>
          <Button onClick={handlePreset} disabled={busy}>
            {c.preset}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-body">
            <thead className="text-left text-caption text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">{c.columns.name}</th>
                <th className="py-2 pr-3 font-medium">{c.columns.strategy}</th>
                <th className="py-2 pr-3 font-medium">{c.columns.price}</th>
                <th className="py-2 pr-3 font-medium">{c.columns.insurance}</th>
                <th className="py-2 pr-3 font-medium">{c.columns.cod}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {options.map((o, i) => (
                <tr key={o.id} className="border-t border-hairline">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={routes.apps.page(APP, 'options', o.id)}
                      className="font-medium text-ink-strong hover:underline"
                    >
                      {o.name}
                    </Link>
                    {o.enabled ? null : (
                      <span className="ml-2 text-caption text-muted-foreground">{c.off}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{c[o.strategy]}</td>
                  <td className="py-2.5 pr-3">{priceOf(o)}</td>
                  <td className="py-2.5 pr-3">
                    {o.insurance.default === 'on' ? c.insuranceOn : c.insuranceOff}
                  </td>
                  <td className="py-2.5 pr-3">
                    {o.speed === 'express' || o.cod.mode === 'prepaid_only'
                      ? c.prepaidOnly
                      : c.codAllowed}
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={copy.moveUp}
                      disabled={busy || i === 0}
                      onClick={() => handleMove(i, -1)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={copy.moveDown}
                      disabled={busy || i === options.length - 1}
                      onClick={() => handleMove(i, 1)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsCard>
  )
}
