import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import StickySideColumn from '@/components/layout/sticky-side-column'

type OrderPageFrameProps = {
  header: ReactNode
  /** The Next step card, full width under the header. */
  nextStep?: ReactNode
  main: ReactNode
  side: ReactNode
  /** Dialogs and the print view, outside the page flow. */
  children?: ReactNode
}

/** The order page's frame (Figma "Orders / Order detail"): header, Next step, then cards in a main column and a side column that stays in view on desktop. */
export default function OrderPageFrame({
  header,
  nextStep,
  main,
  side,
  children,
}: OrderPageFrameProps) {
  return (
    <>
      {/* Detail pages are centred at 75rem (1,200px) like Shopify's: at full width the order
          page ran 1,615px wide and felt crowded (audit #14). Lists stay full width. */}
      <PageBody className="mx-auto max-w-[75rem] gap-6 md:pt-5 md:pb-8 print:hidden">
        {header}
        {nextStep}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem]">
          <div className="flex min-w-0 flex-col gap-6">{main}</div>
          <StickySideColumn as="aside" gap={6}>
            {side}
          </StickySideColumn>
        </div>
      </PageBody>
      {children}
    </>
  )
}
