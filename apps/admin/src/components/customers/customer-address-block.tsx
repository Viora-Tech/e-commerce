import type { ReactNode } from 'react'
import CopyButton from '@/components/fields/copy-button'
import { customerAddressesContent } from '@/data/customer-addresses'
import { useCopy } from '@/hooks/use-copy'
import { addressLines } from '@/lib/address'
import type { CustomerAddressRow } from './customer-detail-types'

type CustomerAddressBlockProps = {
  address: CustomerAddressRow
  /** Buttons under the address (edit, ship here, delete). */
  actions?: ReactNode
}

/** One saved address on the customer page: company, postal lines, GSTIN, copy and actions. */
export default function CustomerAddressBlock({ address, actions }: CustomerAddressBlockProps) {
  // Hooks
  const copy = useCopy(customerAddressesContent)

  // Render logic
  const lines = addressLines(address)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <address className="min-w-0 text-body not-italic">
          {address.businessName ? (
            <p className="break-words font-medium">{address.businessName}</p>
          ) : null}
          {lines.map((l) => (
            <p key={l} className="break-words">
              {l}
            </p>
          ))}
          {address.gstin ? (
            <p className="font-mono text-caption text-muted-foreground">
              {copy.gstinLabel} {address.gstin}
            </p>
          ) : null}
        </address>
        <CopyButton value={lines.join('\n')} what={copy.heading} visible />
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-1">{actions}</div>
      ) : null}
    </div>
  )
}
