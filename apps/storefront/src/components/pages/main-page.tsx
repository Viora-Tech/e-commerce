import { parseRichText, RichTextRenderer } from '@commerce/richtext'

type MainPageProps = { title: string; body: unknown; showTitle: boolean }

/** The page template's main section: the page title and its content. */
export default function MainPage({ title, body, showTitle }: MainPageProps) {
  // Render logic
  const value = parseRichText(body)
  return (
    // Spaced by gap: an unlayered `* { margin: 0 }` reset beats margin utilities.
    <section className="page-width flex flex-col gap-6 py-12">
      {showTitle ? <h1 className="h2">{title}</h1> : null}
      <RichTextRenderer data={value} className="rte" />
    </section>
  )
}
