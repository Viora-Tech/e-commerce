'use client'

import ErrorScreen from '@/components/errors/error-screen'
import { errorPageContent as copy } from '@/data/errors'
import './globals.css'

type GlobalErrorProps = { error: unknown; retry: () => void }

/**
 * The whole store failed (its layout threw, e.g. the database is down), so no layout, theme or
 * global styles are around: this draws its own document, in the checkout's palette, which
 * follows the shopper's light or dark setting. The store's logo and contact load if they can.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <title>{copy.global.tabTitle}</title>
        <ErrorScreen kind="global" error={error} retry={retry} />
      </body>
    </html>
  )
}
