import { type AuthorizeParams, checkAuthorize, consentStore } from '@commerce/api'
import { DEFAULT_CLIENT_SCOPES } from '@commerce/core/api-access'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import ConsentForm from '@/components/mcp/consent-form'
import ConsentState from '@/components/mcp/consent-state'
import { mcpContent } from '@/data/mcp'
import { getSession } from '@/lib/auth'
import { getCopy } from '@/lib/copy-server'
import { mcpHost } from '@/lib/mcp-host'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Allow access', robots: { index: false } }

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const KEYS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'state',
  'resource',
  'scope',
] as const

/**
 * The page an MCP client (Claude, ChatGPT, Cursor, VS Code) opens to sign in: "Allow Claude to
 * use Waimers?", with the areas it may use. Signed-out members sign in first and come back.
 */
export default async function AuthorizePage({ searchParams }: PageProps) {
  await connection()
  const raw = await searchParams
  const params: AuthorizeParams = {}
  for (const key of KEYS) {
    const v = raw[key]
    if (typeof v === 'string') params[key] = v
  }
  const query = new URLSearchParams(params as Record<string, string>).toString()
  const session = await getSession()
  if (!session) redirect(routes.login(`${routes.oauthAuthorize()}?${query}`))

  const copy = await getCopy(mcpContent)
  const { db, origin } = mcpHost()
  const check = await checkAuthorize(db, origin, params)
  if (!check.ok) {
    if (check.redirect) redirect(check.redirect)
    return <ConsentState title={copy.consent.invalid} body={copy.consent.invalidBody} />
  }
  const r = check.request
  const organizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  const store = await consentStore(db, { slug: r.slug, organizationId }, session.user.id)
  if (!store) return <ConsentState title={copy.consent.noStore} body={copy.consent.noStoreBody} />

  return (
    <ConsentForm
      params={params}
      client={r.client.name}
      store={store}
      email={session.user.email}
      member={session.user.name}
      initialScopes={Object.keys(r.requested).length ? r.requested : DEFAULT_CLIENT_SCOPES}
    />
  )
}
