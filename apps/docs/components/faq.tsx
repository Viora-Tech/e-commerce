import type { ReactNode } from 'react'

type FaqProps = {
  children: ReactNode
}

/** FAQ accordion: wraps `<FaqItem>`s in one hairline-topped list. */
export default function Faq({ children }: FaqProps) {
  return <div className="mt-4 border-t border-(--docs-border)">{children}</div>
}
