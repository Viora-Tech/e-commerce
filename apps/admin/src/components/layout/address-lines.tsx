import { cn } from '@commerce/ui/lib/utils'
import { addressLines } from '@/lib/address'

type AddressLinesProps = {
  address: Parameters<typeof addressLines>[0]
  className?: string
}

/** A postal address, one line per row, the same on every page. */
export default function AddressLines({ address, className }: AddressLinesProps) {
  return (
    <address className={cn('flex flex-col gap-0.5 text-body not-italic', className)}>
      {addressLines(address).map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and never reorder.
        <span key={i}>{line}</span>
      ))}
    </address>
  )
}
