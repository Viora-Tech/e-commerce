import type { ReactNode } from 'react'

/** Page frame of the Proofly detail and form screens: centred column with the page gutter. */
export default function ProoflyPageBody({ children }: { children: ReactNode }) {
  // Render logic
  return (
    <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-6 md:px-8 md:pt-5 md:pb-8">
      {children}
    </div>
  )
}
