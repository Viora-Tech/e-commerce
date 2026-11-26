'use client'

import type { DomainView } from '@commerce/core'
import { RefreshCw, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import DomainStatusBadge from '@/components/domains/domain-status-badge'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { affiliatePortalDomainContent } from '@/data/affiliate-portal-domain'
import { domainEdgeContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type PortalAddressStatusProps = {
  domain: DomainView
  canManage: boolean
  checking: boolean
  busy: boolean
  onVerify: () => void
  onDisconnect: () => void
}

export type PortalPhase = 'live' | 'pending' | 'certificate' | 'failed'

/** Where the portal host stands, in the Domains page's terms: live only once SSL is active too. */
export function portalPhase(d: DomainView): PortalPhase {
  if (d.heldElsewhere || d.status === 'failed' || d.sslStatus === 'failed') return 'failed'
  if (d.status === 'pending') return 'pending'
  return d.sslStatus === 'active' ? 'live' : 'certificate'
}

/** The connected portal host: its status, why it is not live yet, Verify and Disconnect. */
export default function PortalAddressStatus({
  domain,
  canManage,
  checking,
  busy,
  onVerify,
  onDisconnect,
}: PortalAddressStatusProps) {
  // Hooks
  const copy = useCopy(affiliatePortalDomainContent)
  const edge = useCopy(domainEdgeContent)
  const [confirm, setConfirm] = useState(false)

  // Event handlers
  const handleConfirm = () => {
    setConfirm(false)
    onDisconnect()
  }

  // Render logic
  const phase = portalPhase(domain)
  const line =
    phase === 'live'
      ? copy.liveHelp
      : phase === 'failed'
        ? domain.heldElsewhere
          ? edge.held
          : (domain.error ?? copy.failed)
        : phase === 'certificate'
          ? copy.sslPending
          : copy.pending

  return (
    <div className="flex flex-col gap-3 border-border border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-body">{domain.hostname}</span>
          <DomainStatusBadge domain={domain} />
        </span>
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={routes.settings.domain(domain.id)} />}
        >
          {copy.manage}
        </Button>
      </div>
      <p className={`text-body ${phase === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>
        {line}
      </p>
      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || checking}
            onClick={() => setConfirm(true)}
          >
            <Trash2 aria-hidden="true" />
            {copy.disconnect}
          </Button>
          {phase === 'live' ? null : (
            <Button
              variant="outline"
              size="sm"
              loading={checking}
              disabled={busy || checking}
              onClick={onVerify}
            >
              <RefreshCw aria-hidden="true" />
              {copy.verify}
            </Button>
          )}
        </div>
      ) : (
        <p className="text-caption text-muted-foreground">{copy.noAccess}</p>
      )}
      <ConfirmDialog
        tone="destructive"
        open={confirm}
        onOpenChange={setConfirm}
        title={copy.disconnectTitle(domain.hostname)}
        body={copy.disconnectBody}
        confirmLabel={copy.disconnectConfirm}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
