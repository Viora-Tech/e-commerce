'use client'

import type { DomainTargets } from '@commerce/core/domains'
import { domainBareGuideContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'

type BareDomainGuideProps = {
  /** The bare domain the merchant typed, already normalised (`brand.in`). */
  apex: string
  targets: DomainTargets
  /** An apex only redirects on this server: ALIAS or flattening would skip our address. */
  apexRedirectOnly: boolean
}

/** The connect dialog's note on the two records a bare domain and its www need. */
export default function BareDomainGuide({ apex, targets, apexRedirectOnly }: BareDomainGuideProps) {
  // Hooks
  const copy = useCopy(domainBareGuideContent)

  // Render logic
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-body">
      <p className="font-medium">{copy.heading}</p>
      <p className="text-muted-foreground">{copy.body}</p>
      <ul className="flex flex-col gap-1 font-mono text-caption">
        <li>{copy.apex(apex, targets.aRecord)}</li>
        <li>{copy.www(`www.${apex}`, targets.cnameTarget)}</li>
      </ul>
      <p className="text-muted-foreground">{apexRedirectOnly ? copy.aliasNo : copy.aliasOk}</p>
    </div>
  )
}
