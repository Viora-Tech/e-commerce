import type { DomainView } from '@commerce/core'
import StatusChip from '@/components/layout/status-chip'
import { domainsContent as copy, domainCertificateContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'

type DomainStatusBadgeProps = {
  domain: Pick<DomainView, 'status' | 'sslStatus' | 'sslReason'>
}

type Tone = 'success' | 'attention' | 'danger' | 'info'

/** One badge for DNS and SSL together, worst state first, as Shopify shows it. */
export function domainStatus(
  d: DomainStatusBadgeProps['domain'],
  certificate: typeof domainCertificateContent,
): { label: string; tone: Tone } {
  if (d.status === 'failed') return { label: copy.status.failed, tone: 'danger' }
  if (d.status === 'pending') return { label: copy.status.pending, tone: 'attention' }
  if (d.sslStatus === 'failed') {
    return d.sslReason === 'dns'
      ? { label: certificate.badgeWaitingDns, tone: 'attention' }
      : { label: certificate.badgeFailed, tone: 'danger' }
  }
  if (d.sslStatus === 'issuing') return { label: copy.status.sslIssuing, tone: 'info' }
  if (d.sslStatus === 'pending') return { label: copy.status.sslPending, tone: 'info' }
  return { label: copy.status.connected, tone: 'success' }
}

/** Status pill for a domain row or header. */
export default function DomainStatusBadge({ domain }: DomainStatusBadgeProps) {
  // Hooks
  const certificate = useCopy(domainCertificateContent)

  // Render logic
  const { label, tone } = domainStatus(domain, certificate)

  return <StatusChip tone={tone}>{label}</StatusChip>
}
