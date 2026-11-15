import { parseRichText, RichTextRenderer } from '@commerce/richtext'
import { policyPageContent as copy } from '@/data/policies'

type PolicyPageProps = { title: string; body: unknown; updatedAt: Date }

/** A store policy: its title, when it last changed, and its text. Rendered on the server. */
export default function PolicyPage({ title, body, updatedAt }: PolicyPageProps) {
  // Render logic
  const value = parseRichText(body)
  return (
    // Spaced by gap and padding: an unlayered `* { margin: 0 }` reset (an imported theme's, and
    // our blocks' base.css) beats margin utilities, which left the date over the title.
    <article className="page-width flex flex-col gap-2 py-12">
      <h1 className="section-title">{title}</h1>
      <p className="pb-6 text-small text-muted">{copy.updated(updatedAt)}</p>
      <RichTextRenderer data={value} className="rte" />
    </article>
  )
}
