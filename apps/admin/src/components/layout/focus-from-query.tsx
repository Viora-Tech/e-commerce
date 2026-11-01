'use client'

import { useEffect } from 'react'
import { focusAndFlash } from '@/lib/focus-flash'

/**
 * `?focus=<field id>` on a detail page: the field is scrolled to, focused and ringed once the
 * page is in (SEO "Edit" opening the Search engine listing, audit #176). Read from the URL in
 * an effect, so the page needs no Suspense boundary for it.
 */
export default function FocusFromQuery() {
  // Hooks
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('focus')
    if (id) focusAndFlash(() => document.getElementById(id))
  }, [])

  return null
}
