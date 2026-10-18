'use server'

import { type AuthorizeParams, decideAuthorize } from '@commerce/api'
import { ApiScopesSchema } from '@commerce/core/api-access'
import { getSession } from '@/lib/auth'
import { mcpHost } from '@/lib/mcp-host'

type Decision = {
  params: AuthorizeParams
  slug: string
  scopes: unknown
  allow: boolean
}

/**
 * Allow or Deny on the consent page. Everything is checked again here (the client, its return
 * address, the member's place in the store); the answer is where to send the browser.
 */
export async function decideConsent(
  input: Decision,
): Promise<{ ok: true; redirect: string } | { ok: false }> {
  const session = await getSession()
  if (!session) return { ok: false }
  const scopes = ApiScopesSchema.safeParse(input.scopes)
  if (input.allow && !scopes.success) return { ok: false }
  const { db, origin } = mcpHost()
  try {
    const redirect = await decideAuthorize(db, origin, {
      params: input.params,
      userId: session.user.id,
      slug: input.slug,
      scopes: scopes.success ? scopes.data : {},
      allow: input.allow,
    })
    return { ok: true, redirect }
  } catch {
    return { ok: false }
  }
}
