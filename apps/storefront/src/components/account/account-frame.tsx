import type { ReactNode } from 'react'

type AccountFrameProps = { children: ReactNode }

/**
 * The page width and spacing every account page sits in. The account and sign-in templates draw
 * it inside their main section (`MainAccount`, `MainLogin`), so sections a merchant adds around
 * them in Customize keep their own full width.
 */
export default function AccountFrame({ children }: AccountFrameProps) {
  // Render logic
  return <div className="page-width py-10 md:py-14">{children}</div>
}
