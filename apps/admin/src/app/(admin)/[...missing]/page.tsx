import { notFound } from 'next/navigation'

/**
 * Any admin address no page matches (/content/content-types, a mistyped link) lands here and
 * shows the admin's own "Page not found" inside the sidebar and top bar, instead of Next's bare
 * black 404 (audit #36). Real routes always win: a catch-all is matched last.
 */
export default function MissingPage() {
  notFound()
}
