import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import { policyPageContent as copy } from '@/data/policies'

type PolicyPageProps = { title: string; body: unknown; updatedAt: Date }

/** A store policy: its title, when it last changed, and its text. Rendered on the server. */
export default function PolicyPage({ title, body, updatedAt }: PolicyPageProps) {
  // Render logic
  const value = parseRichText(body)
  return (
    <article className="page-width mx-auto max-w-3xl py-12">
      <h1 className="h2 mb-2">{title}</h1>
      <p className="mb-8 text-small text-muted">{copy.updated(updatedAt)}</p>
      <RichTextRenderer data={value} className="rte" />
    </article>
  )
}
