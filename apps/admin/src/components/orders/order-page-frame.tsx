import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'

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
      <PageBody width="detail" className="print:hidden">
        {header}
        {nextStep}
        <PageColumns main={main} side={side} sideAs="aside" />
      </PageBody>
      {children}
    </>
  )
}
