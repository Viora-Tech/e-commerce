import { notFound } from 'next/navigation'

/** Any unknown storefront path renders the theme's 404 template with a 404 status. */
export default function MissingPage() {
  notFound()
}
