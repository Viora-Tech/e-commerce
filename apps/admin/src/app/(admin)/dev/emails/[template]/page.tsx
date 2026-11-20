import { renderEmail, TEMPLATE_IDS, TEMPLATE_NAMES } from '@commerce/notifications'
import { loadEnv } from '@commerce/config'
import { sampleEmailBrand, sampleTemplateDataByTemplate } from '@commerce/notifications/testing'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type PageProps = { params: Promise<{ template: string }> }

export const metadata: Metadata = { title: 'Email preview' }

/** Development-only render of one transactional email against sample data. */
export default async function Page({ params }: PageProps) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { template } = await params
  const id = TEMPLATE_IDS.find((t) => t === template)
  if (!id) notFound()

  // The local storefront hosts the email icons (public/email), so the preview loads them.
  const shopUrl = new URL(loadEnv(process.env).STOREFRONT_URL).origin
  const data = { ...sampleTemplateDataByTemplate[id], brand: { ...sampleEmailBrand, shopUrl } }
  const email = await renderEmail(id, data)

  return (
    <div className="mx-auto flex max-w-[48rem] flex-col gap-4 p-8">
      <Link href="/dev/emails" className="text-body text-muted-foreground hover:underline">
        ← All templates
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{TEMPLATE_NAMES[id]}</h1>
        <p className="text-body text-muted-foreground">Subject: {email.subject}</p>
      </div>
      <iframe
        title={`${id} preview`}
        srcDoc={email.html}
        className="h-[42rem] w-full rounded-lg border border-border bg-white"
      />
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-body font-medium">Plain text version</summary>
        <pre className="mt-3 whitespace-pre-wrap text-period text-muted-foreground">
          {email.text}
        </pre>
      </details>
    </div>
  )
}
