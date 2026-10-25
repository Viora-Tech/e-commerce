import type { ReactNode } from 'react'

type TemplateProps = { children: ReactNode }

/** Re-mounts on every route change, so each page fades up on arrival. */
export default function Template({ children }: TemplateProps) {
  return <div className="animate-page-in">{children}</div>
}
