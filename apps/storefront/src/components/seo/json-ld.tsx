import JsonLdScript from '@/components/seo/json-ld-script'
import { flightOnlyRequest } from '@/lib/flight-request'
import { putLiquidSlot } from '@/lib/liquid-slots'
import { jsonLd } from '@/lib/seo'

type JsonLdProps = {
  /** The schema.org object; escaped by `jsonLd()`. */
  data: unknown
}

/**
 * A page's JSON-LD, sent once. A server component's `dangerouslySetInnerHTML` is serialised into
 * the RSC payload as well as written into the HTML, so a product page carried its 15 KB graph
 * twice (waimers.in, 22 Nov 2026). For a page load the JSON reaches the HTML render through a
 * slot (`lib/liquid-slots.ts`) and the payload carries only the slot id; a request answered with
 * the payload alone (a client navigation, an action) carries it inline.
 */
export default async function JsonLd({ data }: JsonLdProps) {
  // Hooks
  const inline = await flightOnlyRequest()

  // Render logic
  const json = jsonLd(data).__html

  return inline ? <JsonLdScript json={json} /> : <JsonLdScript slot={putLiquidSlot(json)} />
}
