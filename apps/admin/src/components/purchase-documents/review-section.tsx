import type { ReactNode } from 'react'

type ReviewSectionProps = {
  heading: string
  children: ReactNode
}

/** One group on the review screen (document, products, charges). */
export default function ReviewSection({ heading, children }: ReviewSectionProps) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-background p-4">
      <h3 className="text-body-strong">{heading}</h3>
      {children}
    </section>
  )
}
