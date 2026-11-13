import type { ChannelTemplateSpec, ChannelTemplateStatus } from '@commerce/notifications'
import {
  type FetchLike,
  GRAPH_API,
  type GraphTemplate,
  param,
  type WhatsappConfig,
} from './whatsapp'

/**
 * Meta's WhatsApp Business Management API for message templates: read every template's review
 * status, and submit a message's template for review. Both use the store's saved access token
 * and WhatsApp Business Account ID; the token only travels in the Authorization header.
 */

type GraphError = { message?: string; error_user_title?: string; error_user_msg?: string }

/** Meta's own words for a refused call: the user-facing message when it gives one. */
export function graphErrorMessage(error: GraphError | undefined, status: number): string {
  const user = error?.error_user_msg?.trim()
  const title = error?.error_user_title?.trim()
  if (user) return title ? `${title}: ${user}` : user
  return error?.message?.trim() || `HTTP ${status}`
}

/** Pages of templates read at most: 5 × 200, far more than any store has. */
const MAX_TEMPLATE_PAGES = 5

/**
 * The POST body that submits one message's template for review: a Utility template in the
 * store's template language whose body carries the `{{n}}` placeholders and an example for each.
 */
export function templateSubmission(spec: ChannelTemplateSpec, language: string) {
  return {
    name: spec.name,
    language,
    category: spec.category,
    components: [
      {
        type: 'BODY',
        text: spec.body,
        ...(spec.examples.length ? { example: { body_text: [spec.examples.map(param)] } } : {}),
      },
    ],
  }
}

const needsWaba = (config: WhatsappConfig): string => {
  if (!config.businessAccountId) throw new Error('WhatsApp Business Account ID is missing')
  return config.businessAccountId
}

/** Every template on the business account with its review status (all pages). */
export async function fetchTemplateStatuses(
  fetchImpl: FetchLike,
  config: WhatsappConfig,
  timeoutMs: number,
): Promise<ChannelTemplateStatus[]> {
  const waba = needsWaba(config)
  const out: ChannelTemplateStatus[] = []
  let url: string | undefined =
    `${GRAPH_API}/${waba}/message_templates?limit=200&fields=name,language,status,category,rejected_reason`
  for (let page = 0; url && page < MAX_TEMPLATE_PAGES; page += 1) {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = (await res.json().catch(() => ({}))) as {
      data?: GraphTemplate[]
      paging?: { next?: string }
      error?: GraphError
    }
    if (!res.ok) throw new Error(graphErrorMessage(json.error, res.status))
    for (const t of json.data ?? []) {
      if (!t.name || !t.language) continue
      out.push({
        name: t.name,
        language: t.language,
        status: t.status ?? '',
        category: t.category ?? '',
        rejectedReason:
          t.rejected_reason && t.rejected_reason !== 'NONE' ? t.rejected_reason : undefined,
      })
    }
    // Only follow Meta's own next-page link.
    const next: string | undefined = json.paging?.next
    url = next?.startsWith(`${GRAPH_API}/`) ? next : undefined
  }
  return out
}

/** Submits one message's template to Meta for review. Codes (Authentication) go by hand. */
export async function postTemplate(
  fetchImpl: FetchLike,
  config: WhatsappConfig,
  spec: ChannelTemplateSpec,
  timeoutMs: number,
): Promise<{ status: string }> {
  const waba = needsWaba(config)
  if (spec.category !== 'UTILITY') {
    throw new Error('Code templates are set up in WhatsApp Manager, not submitted from here')
  }
  const res = await fetchImpl(`${GRAPH_API}/${waba}/message_templates`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(templateSubmission(spec, config.templateLanguage)),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = (await res.json().catch(() => ({}))) as {
    id?: string
    status?: string
    error?: GraphError
  }
  if (!res.ok) throw new Error(graphErrorMessage(json.error, res.status))
  return { status: json.status ?? 'PENDING' }
}
