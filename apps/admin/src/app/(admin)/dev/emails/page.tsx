import { TEMPLATE_IDS, TEMPLATE_NAMES } from '@commerce/notifications'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Email previews' }

/** Development-only index of every transactional email template. */
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="mx-auto max-w-[40rem] p-8">
      <h1 className="mb-1 text-xl font-semibold">Email previews</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Rendered with sample data, straight from @commerce/notifications. Not linked from production
        navigation.
      </p>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {TEMPLATE_IDS.map((id) => (
          <li key={id}>
            <Link
              href={`/dev/emails/${id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted"
            >
              <span>{TEMPLATE_NAMES[id]}</span>
              <span className="text-muted-foreground">{id}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
