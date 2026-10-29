import { siteConfig } from '@commerce/config/site'

/**
 * The platform console's outside reads (developer docs: Operations > Platform console). The
 * database reads live in `@commerce/core` (`platform/*`); this is the one GitHub call.
 */

/** The label every "Report a bug" issue carries (bug-report.service `BUG_REPORT_LABELS`). */
const REPORT_LABEL = 'test-server'

/**
 * Open "Report a bug" issues on the repository, from GitHub's search API. Null when there is
 * no token or GitHub does not answer in time: the Overview then shows a dash, never a guess.
 */
export async function openBugReportCount(input: {
  fetch: typeof fetch
  token: string | undefined
  repo: string
}): Promise<number | null> {
  if (!input.token) return null
  const q = encodeURIComponent(`repo:${input.repo} is:issue is:open label:${REPORT_LABEL}`)
  try {
    const res = await input.fetch(`https://api.github.com/search/issues?q=${q}&per_page=1`, {
      headers: {
        Authorization: `Bearer ${input.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `${siteConfig.brand.name.toLowerCase()}-platform-console`,
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { total_count?: unknown }
    return typeof json.total_count === 'number' ? json.total_count : null
  } catch {
    return null
  }
}
