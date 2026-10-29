/** SOURCE OF TRUTH: GitHub client for bug report status — WHAT: the few GitHub REST calls the report sync and the platform console make (read an issue, its comments and the commit that closed it, check a commit reached main, comment, close, reopen, label) / WHY: `fetch` is injected so tests never reach GitHub, and the token never leaves this module in an error */
import { siteConfig } from '@commerce/config/site'
import { CommerceError } from '../errors'

/** GitHub refused or could not be reached. Carries the HTTP status only, never the token. */
export class GithubApiError extends CommerceError {
  constructor(readonly status: number | null) {
    super('BUG_REPORT_GITHUB_API', status ? `GitHub answered ${status}` : 'GitHub could not be reached')
  }
}

export type GithubClientOptions = {
  fetch: typeof fetch
  token: string
  /** `owner/name`. */
  repo: string
}

export type GithubIssueState = {
  number: number
  state: 'open' | 'closed'
  /** `completed`, `not_planned`, `reopened` or null. */
  stateReason: string | null
  labels: string[]
  closedAt: string | null
}

export type GithubComment = {
  id: number
  body: string
  /** OWNER, MEMBER, COLLABORATOR, CONTRIBUTOR, NONE... */
  authorAssociation: string
  createdAt: string
  updatedAt: string
}

/** Comments per page: one page covers a report's whole conversation in practice. */
const COMMENTS_PER_PAGE = 100

export type GithubClient = ReturnType<typeof githubClient>

/** The calls, bound to one token and repository. */
export function githubClient(opts: GithubClientOptions) {
  const base = `https://api.github.com/repos/${opts.repo}`

  const request = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    let res: Response
    try {
      res = await opts.fetch(`${base}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${opts.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': `${siteConfig.brand.name.toLowerCase()}-bug-reports`,
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new GithubApiError(null)
    }
    if (!res.ok) throw new GithubApiError(res.status)
    return res.status === 204 ? null : ((await res.json()) as unknown)
  }

  return {
    async issue(number: number): Promise<GithubIssueState> {
      const j = (await request(`/issues/${number}`)) as {
        number: number
        state: string
        state_reason?: string | null
        labels?: ({ name?: string } | string)[]
        closed_at?: string | null
      }
      return {
        number: j.number,
        state: j.state === 'closed' ? 'closed' : 'open',
        stateReason: j.state_reason ?? null,
        labels: (j.labels ?? []).map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
        closedAt: j.closed_at ?? null,
      }
    },

    async comments(number: number): Promise<GithubComment[]> {
      const rows = (await request(
        `/issues/${number}/comments?per_page=${COMMENTS_PER_PAGE}`,
      )) as {
        id: number
        body?: string | null
        author_association?: string
        created_at: string
        updated_at: string
      }[]
      return rows.map((c) => ({
        id: c.id,
        body: c.body ?? '',
        authorAssociation: c.author_association ?? 'NONE',
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))
    },

    /** The commit of the latest "closed" event (the fix PR's merge), or null when closed by hand. */
    async closingCommit(number: number): Promise<string | null> {
      const events = (await request(`/issues/${number}/events?per_page=100`)) as {
        event: string
        commit_id?: string | null
      }[]
      const closed = events.filter((e) => e.event === 'closed')
      return closed.at(-1)?.commit_id ?? null
    },

    /** True when `sha` is in `ref`'s history (compare says `ref` is ahead of it, or the same). */
    async contains(ref: string, sha: string): Promise<boolean> {
      const j = (await request(
        `/compare/${encodeURIComponent(sha)}...${encodeURIComponent(ref)}`,
      )) as { status?: string }
      return j.status === 'ahead' || j.status === 'identical'
    },

    async comment(number: number, body: string): Promise<{ id: number; createdAt: string }> {
      const j = (await request(`/issues/${number}/comments`, {
        method: 'POST',
        body: { body },
      })) as { id: number; created_at: string }
      return { id: j.id, createdAt: j.created_at }
    },

    async setState(
      number: number,
      state: 'open' | 'closed',
      stateReason?: 'completed' | 'not_planned' | 'reopened',
    ): Promise<void> {
      await request(`/issues/${number}`, {
        method: 'PATCH',
        body: stateReason ? { state, state_reason: stateReason } : { state },
      })
    },

    async addLabels(number: number, labels: string[]): Promise<void> {
      await request(`/issues/${number}/labels`, { method: 'POST', body: { labels } })
    },

    /** Removes a label; a label the issue does not have is fine. */
    async removeLabel(number: number, label: string): Promise<void> {
      try {
        await request(`/issues/${number}/labels/${encodeURIComponent(label)}`, {
          method: 'DELETE',
        })
      } catch (err) {
        if (err instanceof GithubApiError && err.status === 404) return
        throw err
      }
    },
  }
}
