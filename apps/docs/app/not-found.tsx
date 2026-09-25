import Link from 'next/link'
import { NotFoundPage } from 'nextra-theme-docs'

export default function NotFound() {
  return (
    <NotFoundPage content="Report a broken link">
      <div className="not-prose flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold">Page not found</h1>
        <p className="max-w-md opacity-70">
          We couldn&apos;t find that page. Try the{' '}
          <Link href="/" style={{ color: 'var(--docs-link)' }}>
            homepage
          </Link>{' '}
          or search from the top bar.
        </p>
      </div>
    </NotFoundPage>
  )
}
