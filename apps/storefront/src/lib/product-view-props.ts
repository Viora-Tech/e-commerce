import type { MainProductSettings, ProductDetail } from '@commerce/blocks'
import { compactImageVariants } from '@commerce/blocks/media'

type ViewSettings = Pick<
  MainProductSettings,
  'showDescription' | 'showSpecs' | 'showAccordions'
> & {
  accordions: { metafieldKey: string }[]
}

/**
 * SOURCE OF TRUTH KEYWORDS: product page props, RSC payload, ProductView data
 * WHAT:  The product as the buy box (`ProductView`, a client component) draws it with these
 *        settings: the description only when the description block shows, the extra fields
 *        only when the spec grid or the panels show, and a field's panel HTML only for a field a
 *        panel shows (`metafieldKey`), and each image's variants as widths alone
 *        (`@commerce/blocks/media` `compactImageVariants`, rebuilt by `ProductView`). Everything
 *        else is kept as it is.
 * WHY:   A client component's props are serialised into the page's RSC payload. The Lexical
 *        description alone was 11 KB of a Wooting product page that hides it (waimers.in,
 *        22 Nov 2026); the panel HTML of every spec field another 2 KB; the image variant URLs
 *        about 30 KB on a product with 18 images.
 * WHERE: the storefront product page (`app/-s/[storeId]/products/[handle]/page.tsx`).
 */
export function productForView<P extends Pick<ProductDetail, 'description' | 'fields' | 'images'>>(
  product: P,
  settings: ViewSettings,
): P {
  const panelKeys = new Set(
    settings.showAccordions ? settings.accordions.map((a) => a.metafieldKey).filter(Boolean) : [],
  )
  const needsFields = settings.showSpecs || settings.showAccordions
  const fields =
    needsFields && product.fields
      ? Object.fromEntries(
          Object.entries(product.fields).map(([key, f]) => [
            key,
            panelKeys.has(key) ? f : { ...f, html: null },
          ]),
        )
      : undefined
  return {
    ...product,
    description: settings.showDescription ? product.description : null,
    fields,
    images: product.images.map(compactImageVariants),
  } as P
}
