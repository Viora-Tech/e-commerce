'use client'

import { Search } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import {
  gatewayCatalogue,
  type MethodId,
  methodNames,
  paymentsSetupContent as setupCopy,
} from '@/data/payments-setup'
import GatewayLogo from './gateway-logo'
import type { PaymentsSetup } from './types'

type AddGatewayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gateways: PaymentsSetup['gateways']
  /** Resolves when the app is ready to connect; the caller installs and navigates. */
  onConnect: (id: string) => Promise<void>
}

const copy = setupCopy.add

const FILTERS: MethodId[] = ['upi', 'card', 'netbanking', 'wallet', 'emi']

/** "+ Add another way to get paid": search, filter by way to pay, connect. */
export default function AddGatewayDialog({
  open,
  onOpenChange,
  gateways,
  onConnect,
}: AddGatewayDialogProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [busy, setBusy] = useState<string | null>(null)

  // Event handlers
  const handleFilter = (next: string[]) => setFilter(next[0] ?? 'all')

  const handleConnect = async (id: string) => {
    setBusy(id)
    try {
      await onConnect(id)
    } finally {
      setBusy(null)
    }
  }

  // Render logic
  const q = query.trim().toLowerCase()
  const shipped = new Map(gateways.map((g) => [g.id, g]))
  const results = gatewayCatalogue.filter(
    (g) =>
      (!q || g.name.toLowerCase().includes(q) || g.blurb.toLowerCase().includes(q)) &&
      (filter === 'all' || g.methods.includes(filter as MethodId)),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            size="lg"
            className="pl-9"
            aria-label={copy.search}
            placeholder={copy.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ToggleGroup
          value={[filter]}
          onValueChange={handleFilter}
          variant="outline"
          size="sm"
          spacing={2}
          className="flex-wrap"
        >
          <ToggleGroupItem value="all">{copy.all}</ToggleGroupItem>
          {FILTERS.map((id) => (
            <ToggleGroupItem key={id} value={id}>
              {methodNames[id].name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ul className="-mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1">
          {results.length === 0 ? (
            <li className="py-6 text-center text-body text-muted-foreground">{copy.noResults}</li>
          ) : null}
          {results.map((g) => {
            const app = shipped.get(g.id)
            const canConnect = g.available && !!app
            return (
              <li key={g.id} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-start gap-3">
                  <GatewayLogo monogram={g.monogram} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="text-body font-semibold text-foreground">{g.name}</p>
                    <p className="text-caption text-muted-foreground">{g.blurb}</p>
                  </div>
                  {app?.connected ? (
                    <Badge variant="success">{copy.connected}</Badge>
                  ) : canConnect ? (
                    <Button size="sm" onClick={() => handleConnect(g.id)} disabled={busy !== null}>
                      {busy === g.id ? <Spinner /> : null}
                      {busy === g.id ? copy.installing : copy.connect}
                    </Button>
                  ) : (
                    <Badge variant="neutral">{copy.comingSoon}</Badge>
                  )}
                </div>
                <p className="text-caption text-muted-foreground">
                  {g.methods.map((m) => methodNames[m].name).join(' · ')}
                </p>
                <dl className="grid gap-1 text-caption sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium text-foreground">{copy.fees}: </dt>
                    <dd className="inline text-muted-foreground">{g.fees}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-foreground">{copy.settlement}: </dt>
                    <dd className="inline text-muted-foreground">{g.settlement}</dd>
                  </div>
                </dl>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
