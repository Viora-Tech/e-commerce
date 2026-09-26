/**
 * Client credentials grant for a Dev Dashboard app installed on the merchant's
 * own store: exchanges the app's client ID and secret for a short-lived Admin
 * API access token. No redirect, no callback URL — this is the flow Shopify
 * documents for a store getting its own app's token, not the authorization
 * code flow used to onboard other merchants.
 *
 * Endpoint, request and response verified against:
 * https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
 * `expires_in` is documented as always 86399 seconds (~24 hours).
 */

export class ShopifyOAuthError extends Error {}

export type ClientCredentialsToken = {
  accessToken: string
  /** ISO timestamp; refresh a little before this. */
  expiresAt: string
  scope: string
}

type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string }

/** Refresh this long before the token actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

export function isExpiring(expiresAt: string | null, marginMs = TOKEN_REFRESH_MARGIN_MS): boolean {
  if (!expiresAt) return true
  return new Date(expiresAt).getTime() - marginMs <= Date.now()
}

/**
 * `POST https://{shop}.myshopify.com/admin/oauth/access_token`,
 * `application/x-www-form-urlencoded`, `grant_type=client_credentials`.
 */
export async function fetchClientCredentialsToken(
  shopDomain: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientCredentialsToken> {
  const res = await fetchImpl(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })
  if (res.status === 401 || res.status === 400) {
    throw new ShopifyOAuthError(
      'Shopify rejected the client ID or client secret. Check them and try again.',
    )
  }
  if (!res.ok) {
    throw new ShopifyOAuthError(`Shopify could not issue a token (${res.status}). Try again later.`)
  }
  const body = (await res.json()) as TokenResponse
  if (!body.access_token || !body.expires_in) {
    throw new ShopifyOAuthError('Shopify did not return an access token.')
  }
  return {
    accessToken: body.access_token,
    expiresAt: new Date(Date.now() + body.expires_in * 1000).toISOString(),
    scope: body.scope ?? '',
  }
}
