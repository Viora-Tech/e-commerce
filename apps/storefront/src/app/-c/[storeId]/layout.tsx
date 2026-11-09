import type { Metadata } from 'next'
import type { ReactNode } from 'react'

type Props = { children: ReactNode }

export const metadata: Metadata = { robots: { index: false, follow: false } }

/**
 * The plain HTML page's chat frame (`lib/inbox-frame.ts`): a bare document the chat card fills.
 * Links in the chat (a product card, an order) open in the page around the frame, not inside it.
 */
export default function ChatFrameLayout({ children }: Props) {
  return (
    <html lang="en" className="overflow-hidden">
      <head>
        <base target="_top" />
      </head>
      <body className="m-0 overflow-hidden bg-transparent">{children}</body>
    </html>
  )
}
