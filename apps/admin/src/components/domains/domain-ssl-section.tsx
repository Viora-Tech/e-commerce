'use client'

import type { DomainView } from '@commerce/core'
import { RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { domainCertificateContent, domainEdgeContent, domainsContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const copy = domainsContent.detail

type DomainSslSectionProps = {
  domain: DomainView
  canManage: boolean
  onChange: (next: DomainView) => void
}

/** The certificate state of one domain, what to do about it, and "Retry certificate". */
export default function DomainSslSection({ domain, canManage, onChange }: DomainSslSectionProps) {
  // Hooks
  const certificate = useCopy(domainCertificateContent)
  const edge = useCopy(domainEdgeContent)
  const [retrying, setRetrying] = useState(false)

  // Event handlers
  const handleRetry = async () => {
    setRetrying(true)
    try {
      onChange(await api.domains.retryCertificate({ id: domain.id }))
      toast.success(certificate.retryStarted)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : certificate.retryFailed)
    } finally {
      setRetrying(false)
    }
  }

  // Render logic
  const sslState = domain.status === 'active' ? domain.sslStatus : 'pending'
  const text = (() => {
    if (domain.heldElsewhere) return edge.held
    if (sslState === 'failed') {
      return domain.sslReason === 'dns' ? certificate.waitingDns : certificate.failed
    }
    if (sslState !== 'issuing') return copy.ssl[sslState]
    return domain.routeStatus === 'failed' ? certificate.retrying : certificate.issuing
  })()
  // Cloudflare holds the certificate of a row it took on: "Verify connection" asks it again.
  const canRetry =
    canManage &&
    domain.status === 'active' &&
    domain.sslStatus !== 'active' &&
    domain.edgeRecords === null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-strong text-ink-strong">{copy.ssl.heading}</p>
      <p className="text-body text-muted-foreground">{text}</p>
      {domain.sslStatus === 'failed' && domain.error && !domain.heldElsewhere ? (
        <p className="text-caption text-destructive">{domain.error}</p>
      ) : null}
      {canRetry ? (
        <div>
          <Button variant="outline" size="sm" disabled={retrying} onClick={handleRetry}>
            <RotateCcw aria-hidden="true" />
            {retrying ? certificate.retryBusy : certificate.retry}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
