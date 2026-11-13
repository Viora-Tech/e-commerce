/**
 * The element React rendered into: our section's wrapper (`<div class="shopify-section">`, the
 * one with no id; the theme's own sections carry theirs), or the `section-frame` inside it.
 */
export function islandContainer(doc: Document, framed: boolean): Element | null {
  const main = doc.getElementById('MainContent')
  if (!main) return null
  const wrapper = [...main.children].find(
    (el) => el.tagName === 'DIV' && el.className === 'shopify-section' && !el.id,
  )
  if (!wrapper) return null
  return framed ? wrapper.firstElementChild : wrapper
}
