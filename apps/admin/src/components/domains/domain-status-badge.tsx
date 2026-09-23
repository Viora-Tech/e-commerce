import type { DomainView } from '@commerce/core'
import { Badge } from '@commerce/ui/shadcn/badge'
import { domainsContent as copy } from '@/data/domains'

type DomainStatusBadgeProps = {
  domain: Pick<DomainView, 'status' | 'sslStatus'>
}

type Tone = 'success' | 'warning' | 'destructive' | 'info'

/** One badge for DNS and SSL together, worst state first, as Shopify shows it. */
export function domainStatus(d: DomainStatusBadgeProps['domain']): { label: string; tone: Tone } {
  if (d.status === 'failed') return { label: copy.status.failed, tone: 'destructive' }
  if (d.status === 'pending') return { label: copy.status.pending, tone: 'warning' }
  if (d.sslStatus === 'failed') return { label: copy.status.sslFailed, tone: 'destructive' }
  if (d.sslStatus === 'issuing') return { label: copy.status.sslIssuing, tone: 'info' }
  if (d.sslStatus === 'pending') return { label: copy.status.sslPending, tone: 'info' }
  return { label: copy.status.connected, tone: 'success' }
}

/** Status pill for a domain row or header. */
export default function DomainStatusBadge({ domain }: DomainStatusBadgeProps) {
  // Render logic
  const { label, tone } = domainStatus(domain)

  return <Badge variant={tone}>{label}</Badge>
}
