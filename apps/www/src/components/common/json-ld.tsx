import type { JsonLd as JsonLdData } from '@/lib/seo'

type JsonLdProps = { data: JsonLdData | readonly JsonLdData[] }

/** Structured data for search engines (`lib/seo.ts`). `<` is escaped so no text can end the tag. */
export default function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  // biome-ignore lint/security/noDangerouslySetInnerHtml: our own JSON, with `<` escaped
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
