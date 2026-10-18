import type { ReactNode } from 'react'
import PageBody from '@/components/layout/page-body'

type OrderPageFrameProps = {
  header: ReactNode
  /** The Next step card, full width under the header. */
  nextStep?: ReactNode
  main: ReactNode
  side: ReactNode
  /** Dialogs and the print view, outside the page flow. */
  children?: ReactNode
}

/** The order page's frame (Figma "Orders / Order detail"): header, Next step, then cards in a main column and a side column. */
export default function OrderPageFrame({
  header,
  nextStep,
  main,
  side,
  children,
}: OrderPageFrameProps) {
  return (
    <>
      <PageBody className="gap-6 md:py-8 print:hidden">
        {header}
        {nextStep}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem]">
          <div className="flex min-w-0 flex-col gap-6">{main}</div>
          <aside className="flex min-w-0 flex-col gap-6">{side}</aside>
        </div>
      </PageBody>
      {children}
    </>
  )
}
