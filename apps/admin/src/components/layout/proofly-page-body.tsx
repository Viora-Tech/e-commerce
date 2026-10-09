import type { ReactNode } from 'react'

/** Page frame of the Proofly detail and form screens: centred column with the page gutter. */
export default function ProoflyPageBody({ children }: { children: ReactNode }) {
  // Render logic
  return (
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {children}
    </div>
  )
}
