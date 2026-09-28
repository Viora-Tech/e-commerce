'use client'

import { InfoIcon } from '@commerce/ui/icons'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@commerce/ui/shadcn/popover'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

/** "What's this?" for the two UPI options: who marks the order paid, fake-payment risk, fee, payout. */
export default function UpiCompare() {
  // Hooks
  const {
    upiOptions: { compare: copy },
  } = useCopy(paymentsSetupContent)

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-caption font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InfoIcon aria-hidden="true" className="size-3.5" />
        {copy.trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{copy.title}</PopoverTitle>
        </PopoverHeader>
        <table className="w-full text-caption">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-medium" />
              <th className="py-1 pr-2 font-medium">{copy.autoHeading}</th>
              <th className="py-1 font-medium">{copy.manualHeading}</th>
            </tr>
          </thead>
          <tbody>
            {copy.rows.map((r) => (
              <tr key={r.label} className="border-t border-border align-top">
                <th scope="row" className="py-1.5 pr-2 text-left font-medium text-foreground">
                  {r.label}
                </th>
                <td className="py-1.5 pr-2 text-muted-foreground">{r.auto}</td>
                <td className="py-1.5 text-muted-foreground">{r.manual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PopoverContent>
    </Popover>
  )
}
