/**
 * URL redirect rules, pure so the admin form, the importer and the storefront
 * proxy agree on what a redirect path is. Safe in client bundles.
 */
import { z } from 'zod'

export const MAX_REDIRECT_PATH = 500

/**
 * `/Products/Old-Tee/?utm=x` → `/products/old-tee`. Storefront lookups compare
 * this form by equality, so matching is case-insensitive and ignores a
 * trailing slash and the query string, as Shopify's redirects do.
 */
export function normaliseRedirectPath(input: string): string {
  let value = input.trim()
  // An absolute URL pasted into "Redirect from" keeps only its path.
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname
    } catch {
      return ''
    }
  }
  value = value.split(/[?#]/)[0] ?? ''
  try {
    value = decodeURI(value)
  } catch {
    // Leave malformed escapes as they are.
  }
  if (!value.startsWith('/')) value = `/${value}`
  value = value.replace(/\/{2,}/g, '/')
  if (value.length > 1) value = value.replace(/\/+$/, '')
  return value.toLowerCase()
}

/** A target is a store path (`/collections/new`) or an absolute http(s) URL. */
export function normaliseRedirectTarget(input: string): string {
  const value = input.trim()
  if (/^https?:\/\//i.test(value)) return value
  return value.startsWith('/') ? value : `/${value}`
}

export function redirectPathError(path: string): string | null {
  if (!path || path === '/') return 'Enter the old path, for example /products/old-name'
  if (path.length > MAX_REDIRECT_PATH) return 'Path is too long'
  if (/\s/.test(path)) return 'Paths cannot contain spaces'
  if (path.startsWith('/-') || path.startsWith('/_next') || path.startsWith('/api/')) {
    return 'That path is reserved'
  }
  return null
}

export function redirectTargetError(target: string): string | null {
  if (!target || target === '') return 'Enter where the old path should go'
  if (target.length > 2000) return 'Target is too long'
  if (/^https?:\/\//i.test(target)) {
    try {
      new URL(target)
      return null
    } catch {
      return 'Enter a valid URL'
    }
  }
  if (/\s/.test(target)) return 'Paths cannot contain spaces'
  return null
}

export const RedirectWriteSchema = z
  .object({
    path: z.string().trim().min(1).max(MAX_REDIRECT_PATH),
    target: z.string().trim().min(1).max(2000),
  })
  .transform((v, ctx) => {
    const path = normaliseRedirectPath(v.path)
    const target = normaliseRedirectTarget(v.target)
    const pathError = redirectPathError(path)
    const targetError = redirectTargetError(target)
    if (pathError) ctx.addIssue({ code: 'custom', path: ['path'], message: pathError })
    if (targetError) ctx.addIssue({ code: 'custom', path: ['target'], message: targetError })
    if (!targetError && normaliseRedirectPath(target) === path && target.startsWith('/')) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'A path cannot redirect to itself',
      })
    }
    return { path, target }
  })
export type RedirectWrite = z.output<typeof RedirectWriteSchema>

/**
 * Shopify URL shapes the storefront answers with a built-in 301, without a
 * stored redirect: a product opened inside a collection
 * (`/collections/<c>/products/<h>`) and `/collections/all/products/<h>`, plus a
 * blog tag listing (`/blogs/<b>/tagged/<t>`), which lands on the blog.
 */
export function builtInRedirect(pathname: string): string | null {
  const product = /^\/collections\/[^/]+\/products\/([^/]+)\/?$/i.exec(pathname)
  if (product?.[1]) return `/products/${product[1]}`
  const tagged = /^\/blogs\/([^/]+)\/tagged\/[^/]+\/?$/i.exec(pathname)
  if (tagged?.[1]) return `/blogs/${tagged[1]}`
  return null
}

/** Carry the incoming query string onto a target that has none of its own. */
export function withQuery(target: string, search: string): string {
  if (!search || search === '?' || target.includes('?')) return target
  return `${target}${search.startsWith('?') ? search : `?${search}`}`
}
