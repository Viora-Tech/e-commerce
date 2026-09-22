/** Customize opened on a page's template: the home template for `home`, else its page template. */
export function customizeHref(
  themeId: string | null,
  page: { id: string; handle: string; templateSuffix: string | null },
): string {
  if (!themeId) return '/online-store/themes'
  const base = `/online-store/themes/${themeId}/editor`
  if (page.handle === 'home') return `${base}?template=home`
  const suffix = page.templateSuffix ? `&suffix=${encodeURIComponent(page.templateSuffix)}` : ''
  return `${base}?template=page${suffix}&resource=${page.id}`
}
