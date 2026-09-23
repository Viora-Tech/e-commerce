import { parseRichText, RichTextRenderer } from '@commerce/richtext'

type MainPageProps = { title: string; body: unknown; showTitle: boolean }

/** The page template's main section: the page title and its content. */
export default function MainPage({ title, body, showTitle }: MainPageProps) {
  // Render logic
  const value = parseRichText(body)
  return (
    <section className="page-width mx-auto max-w-3xl py-12">
      {showTitle ? <h1 className="h2 mb-6">{title}</h1> : null}
      <RichTextRenderer data={value} className="rte" />
    </section>
  )
}
