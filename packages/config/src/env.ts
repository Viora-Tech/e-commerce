import { z } from 'zod'
import { siteConfig } from './site'

/**
 * The platform's own email sending: one Amazon SES account for every store.
 * `SENDER_EMAIL_PROVIDER=dev` (default) checks sender domains offline and
 * sends nothing; `ses` needs the SES_* keys and PLATFORM_EMAIL_FROM.
 */
const platformEmailShape = {
  SENDER_EMAIL_PROVIDER: z.enum(['dev', 'ses']).default('dev'),
  /** The platform SES account (also used by the SES live test suite). */
  SES_REGION: z.string().min(1).optional(),
  SES_ACCESS_KEY_ID: z.string().min(1).optional(),
  SES_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /** Optional configuration set every store identity uses by default (bounce/complaint events). */
  SES_CONFIGURATION_SET: z.string().min(1).optional(),
  /** The platform's verified sender, used until a store's own address is verified. */
  PLATFORM_EMAIL_FROM: z.string().email().optional(),
  /** Display name when a store has no name yet. */
  PLATFORM_EMAIL_NAME: z.string().min(1).default(siteConfig.brand.name),
}

/** Optional, and a blank value (compose's `${KEY:-}`) counts as unset. */
function optionalOrBlank<T extends z.ZodType>(inner: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), inner.optional())
}

/** Comma-separated list, trimmed, lowercased, blanks dropped. */
const commaList = z
  .string()
  .default('')
  .transform((s) =>
    s
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  )

/**
 * The AI engine (`@commerce/ai`): one platform key for every store, merchants never bring
 * their own. `AI_PROVIDER` unset picks the gateway whose key is set (Vercel AI Gateway
 * first, then OpenRouter); with no key AI is off and the admin hides every AI button.
 * `mock` answers from a built-in fake model (local demos and screenshots, refused in
 * production); `off` turns AI off even with a key.
 */
const aiShape = {
  AI_PROVIDER: optionalOrBlank(z.enum(['gateway', 'openrouter', 'mock', 'off'])),
  /** Vercel AI Gateway key (https://vercel.com/ai-gateway). */
  AI_GATEWAY_API_KEY: optionalOrBlank(z.string().min(1)),
  /** OpenRouter key (https://openrouter.ai/keys). */
  OPENROUTER_API_KEY: optionalOrBlank(z.string().min(1)),
  /** Overrides the fast model (chat, tools, quick writing), e.g. `openai/gpt-4.1-mini`. Unset: the default in @commerce/ai `MODEL_TIERS`. */
  AI_MODEL: optionalOrBlank(z.string().min(3)),
  /** Overrides the stronger model used for long writing when a store picks "Best" quality. Unset: the default in `MODEL_TIERS`. */
  AI_MODEL_STRONG: optionalOrBlank(z.string().min(3)),
  /** Store slugs on the unlimited AI plan, comma-separated (the platform's own stores, e.g. `waimers`). */
  AI_UNLIMITED_STORES: commaList,
}

/** `true` / `false` (also `1` / `0`, `yes` / `no`), any case. Anything else is refused. */
const flag = z
  .string()
  .default('false')
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0', 'yes', 'no']))
  .transform((v) => v === 'true' || v === '1' || v === 'yes')

/**
 * The "Report a bug" button (test server only). On, every signed-in admin member sees it and
 * each report becomes a GitHub issue. With no token, development logs the would-be issue to
 * the server console instead; production refuses to start (the refine below).
 */
const bugReportShape = {
  BUG_REPORTS_ENABLED: flag,
  /**
   * Fine-grained GitHub token for the one repository, with only "Issues: Read and write".
   * Never a classic token or one with code access.
   */
  GITHUB_ISSUES_TOKEN: z.string().min(1).optional(),
  /** `owner/name` of the repository reports are filed in. */
  GITHUB_ISSUES_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('Viora-Tech/e-commerce'),
  /** The commit this build runs, shown on each bug report. Unset: SENTRY_RELEASE, then "unknown". */
  SOURCE_COMMIT: z.string().min(1).optional(),
}

/** Comma-separated platform domains; they and their subdomains cannot be connected as custom. */
const platformDomains = z
  .string()
  .default('localhost')
  .transform((s) =>
    s
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  )

/** SETTINGS_SECRET's development default. Public, so production refuses it (see `schema`). */
const DEV_SETTINGS_SECRET = 'dev-only-settings-secret'

/** RFC 5737 documentation address: the offline default, never a real server. */
const DOC_A_RECORD = '192.0.2.10'

const shape = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_OWNER: z.string().url(),
  REDIS_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  /** Image jobs the worker runs at once; unset uses `QUEUE_LIMITS.mediaProcess` (3). Keep it near the box's vCPU count. */
  MEDIA_PROCESS_CONCURRENCY: z.coerce.number().int().min(1).max(8).optional(),
  /** Most image jobs of one store at once (capped at the concurrency); unset uses `QUEUE_LIMITS.mediaProcess` (3). */
  MEDIA_PROCESS_PER_STORE: z.coerce.number().int().min(1).max(8).optional(),
  /**
   * Memory the storefront's render cache may hold (rendered theme sections and store data), in
   * MB; unset is 48. 0 turns the cache off (every page renders from the database).
   */
  STOREFRONT_CACHE_MB: z.coerce.number().int().min(0).max(4096).optional(),
  /**
   * How long a shared cache (Cloudflare, a CDN) may keep a page for visitors without cookies,
   * in seconds (`s-maxage`); unset is 30. 0 keeps every page private.
   */
  STOREFRONT_EDGE_TTL: z.coerce.number().int().min(0).max(86_400).optional(),
  /**
   * How many sections of an imported theme's page are sent first and drawn as the theme wrote
   * them; the rest stream in behind them in the same response, their images lazy and their
   * scripts started near the viewport. Unset is 3.
   */
  STOREFRONT_EAGER_SECTIONS: z.coerce.number().int().min(1).max(50).optional(),
  /** Better Auth signing secret. Required by the admin app only. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Public URL of the admin app, used as Better Auth's baseURL. */
  ADMIN_URL: z.string().url().default('http://localhost:3200'),
  /**
   * Platform storefront URL. Fallback only: store links use the store's live primary domain
   * (`storefrontOriginFor` in `@commerce/core`), this URL when a store has none, and always
   * in development (a localhost URL).
   */
  STOREFRONT_URL: z.string().url().default('http://localhost:3100'),
  /** Encrypts gateway credentials stored in store settings. */
  SETTINGS_SECRET: z.string().min(16).default(DEV_SETTINGS_SECRET),
  /**
   * Retired SETTINGS_SECRET value(s), comma-separated, kept only while
   * `scripts/rotate-secrets.ts --apply` re-encrypts everything under the new
   * SETTINGS_SECRET. Decryption tries these after the current key.
   */
  SETTINGS_SECRET_PREVIOUS: z.string().optional(),
  /**
   * Encrypts backup archives (`scripts/backup-db.ts`). Separate from
   * SETTINGS_SECRET so a compromised app secret can't also open the backups.
   * Required in production; dev without it writes unencrypted backups.
   */
  BACKUP_ENCRYPTION_KEY: z.string().min(16).optional(),
  /**
   * Umami addresses the server may reach on a private network or over http (comma-separated
   * origins, e.g. our own `http://umami:3000`). Every other Umami address a store saves goes
   * through the SSRF guard (`@commerce/core/safe-fetch`): public https hosts only.
   */
  UMAMI_TRUSTED_ORIGINS: z.string().optional(),
  /**
   * Razorpay Technology Partner OAuth app ("Connect Razorpay"). Both set turns
   * the one-click connect button on; unset, merchants paste API keys instead.
   * The app's redirect URL must be `<ADMIN_URL>/api/apps/razorpay/oauth/callback`.
   */
  RAZORPAY_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  RAZORPAY_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  /**
   * Checks custom domains' DNS and certificates. `dev` decides from the hostname, offline;
   * `dns` asks real DNS and does a TLS handshake (needs a real STOREFRONT_A_RECORD).
   */
  DOMAIN_PROVIDER: z.enum(['dev', 'dns']).default('dev'),
  /**
   * The storefront server's public IPv4: an apex custom domain's A record must point at it
   * (a subdomain may too, instead of the CNAME). Default is a documentation address.
   */
  STOREFRONT_A_RECORD: z.ipv4().default(DOC_A_RECORD),
  /** Hostname a subdomain's CNAME must point at. */
  STOREFRONT_CNAME_TARGET: z.string().min(3).default('shops.waimers.localhost'),
  PLATFORM_DOMAINS: platformDomains,
  /**
   * Automatic HTTPS routes for custom domains (worker only). With all three set, a custom
   * domain whose DNS is verified is added to the storefront app in Dokploy (https, Let's
   * Encrypt, path `/`) and deleted again when the merchant removes it. Any one unset: the
   * step is skipped and routes are added by hand, as before.
   * `DOKPLOY_URL` is Dokploy's base URL (no `/api`); the key comes from Dokploy → Settings →
   * Profile → API/CLI and is only ever sent in the `x-api-key` header.
   */
  DOKPLOY_URL: optionalOrBlank(z.url({ protocol: /^https?$/ })),
  DOKPLOY_API_KEY: optionalOrBlank(z.string().min(1)),
  /** The storefront application's id in Dokploy (the `applicationId` in its URL). */
  DOKPLOY_STOREFRONT_APPLICATION_ID: optionalOrBlank(z.string().min(1)),
  /** The port the storefront container listens on (`next start --port 3100`). */
  DOKPLOY_STOREFRONT_PORT: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().min(1).max(65535).default(3100),
  ),
  /**
   * Whose client-IP header per-IP rate limits believe (`@commerce/core` `clientIp`).
   * `none` (default): no forwarded header, only the peer address the server sees.
   * `cloudflare`: `cf-connecting-ip`, and only safe when the origin is firewalled to
   * Cloudflare's IP ranges (deployment runbook, "Lock the origin to Cloudflare").
   */
  TRUSTED_PROXY: z.enum(['cloudflare', 'none']).default('none'),
  /** Dev seed: this email becomes owner of the seeded Waimers store. */
  SEED_OWNER_EMAIL: z.string().email().optional(),
  /**
   * Who may sign up and create their own store. `invite` (default): only
   * emails with a live `bun run platform:invite <email>` invite. `open`:
   * anyone who signs in with no store yet can create one. Never affects
   * staff invitations to an existing store, which always work.
   */
  MERCHANT_SIGNUP_MODE: z.enum(['invite', 'open']).default('invite'),
  /**
   * "Continue with Google" for merchants and staff on the admin login page (a Google Cloud
   * OAuth web client). Both set turns the button on; either blank hides it
   * (`merchantGoogleSignIn`). The authorised redirect URI is
   * `<ADMIN_URL>/api/auth/callback/google`. Not the shopper keys below.
   */
  MERCHANT_GOOGLE_CLIENT_ID: optionalOrBlank(z.string().min(1)),
  MERCHANT_GOOGLE_CLIENT_SECRET: optionalOrBlank(z.string().min(1)),
  /**
   * The Google Search Console app's OAuth web client (scope `webmasters`). Both blank: the app
   * uses the MERCHANT_GOOGLE_* client instead; set these to keep Search Console in its own
   * Google Cloud project (its own consent screen and verification). The authorised redirect
   * URI is `<ADMIN_URL>/api/apps/google-search-console/oauth/callback`.
   */
  GSC_GOOGLE_CLIENT_ID: optionalOrBlank(z.string().min(1)),
  GSC_GOOGLE_CLIENT_SECRET: optionalOrBlank(z.string().min(1)),
  /** `<slug>.<PLATFORM_STORE_DOMAIN>` becomes a new store's primary domain. */
  PLATFORM_STORE_DOMAIN: z.string().min(1).default('waimers.store'),
  /**
   * The one platform login domain every store's "Continue with Google / Apple / Facebook"
   * goes through (the storefront app answers it). Default `https://accounts.<PLATFORM_STORE_DOMAIN>`.
   * Provider redirect URIs are `<ACCOUNTS_URL>/oauth/<provider>/callback`.
   */
  ACCOUNTS_URL: z.string().url().optional(),
  /** The platform's own shopper sign-in apps. Unset: merchants can still add their own. */
  SHOPPER_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  SHOPPER_GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  /** Apple Services ID, team, key id and the .p8 private key (PEM, `\n` escapes allowed). */
  SHOPPER_APPLE_SERVICES_ID: z.string().min(1).optional(),
  SHOPPER_APPLE_TEAM_ID: z.string().min(1).optional(),
  SHOPPER_APPLE_KEY_ID: z.string().min(1).optional(),
  SHOPPER_APPLE_PRIVATE_KEY: z.string().min(1).optional(),
  SHOPPER_FACEBOOK_APP_ID: z.string().min(1).optional(),
  SHOPPER_FACEBOOK_APP_SECRET: z.string().min(1).optional(),
  /** Truecaller partner key and app name from the Truecaller developer portal (web SDK). */
  SHOPPER_TRUECALLER_PARTNER_KEY: z.string().min(1).optional(),
  SHOPPER_TRUECALLER_PARTNER_NAME: z.string().min(1).optional(),
  /**
   * The platform's own store that sells plans. A paid order there with a product tagged
   * `platform-plan` gives the buyer's email a signup invite. Unset: nothing happens.
   */
  PLATFORM_SALES_STORE_ID: z.string().uuid().optional(),
  /** GlitchTip (or Sentry) DSN. Error tracking is entirely off, in every app, unless this is set. */
  SENTRY_DSN: z.string().url().optional(),
  /** Free-text environment tag on every event, e.g. production, staging. Defaults by NODE_ENV. */
  SENTRY_ENVIRONMENT: z.string().min(1).optional(),
  /** Release tag on every event, e.g. a git SHA. Unset means Sentry leaves it out. */
  SENTRY_RELEASE: z.string().min(1).optional(),
  /** Cloudflare R2 credentials the backup script uploads to. Independent of a store's own R2 app config. */
  BACKUP_R2_ACCOUNT_ID: z.string().min(1).optional(),
  BACKUP_R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  BACKUP_R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  BACKUP_R2_BUCKET: z.string().min(1).optional(),
  /** Write backups to this local folder instead of R2. Takes priority over BACKUP_R2_* when set. */
  BACKUP_LOCAL_DIR: z.string().min(1).optional(),
  /** Folder the built-in local storage provider reads and writes. Default ./.data/uploads. */
  LOCAL_STORAGE_DIR: z.string().min(1).optional(),
  ...platformEmailShape,
  ...aiShape,
  ...bugReportShape,
  NODE_ENV: z.string().optional(),
})

const schema = shape
  .refine((e) => !(e.NODE_ENV === 'production' && e.SETTINGS_SECRET === DEV_SETTINGS_SECRET), {
    // The default is public (it is in this file). In production it would encrypt every
    // store's gateway keys and sign every token with a value anyone can read; a blank or
    // missing SETTINGS_SECRET must stop the app, never fall back to it.
    message: 'SETTINGS_SECRET is required in production (16+ random characters)',
    path: ['SETTINGS_SECRET'],
  })
  .refine((e) => e.DOMAIN_PROVIDER !== 'dns' || e.STOREFRONT_A_RECORD !== DOC_A_RECORD, {
    // Merchants would be told to point their domain at a documentation address.
    message: 'DOMAIN_PROVIDER=dns needs the server IPv4 in STOREFRONT_A_RECORD',
    path: ['STOREFRONT_A_RECORD'],
  })
  .refine(
    (e) => !(e.BUG_REPORTS_ENABLED && !e.GITHUB_ISSUES_TOKEN && e.NODE_ENV === 'production'),
    {
      // In production a report must reach GitHub; a console line nobody reads would lose it.
      message:
        'BUG_REPORTS_ENABLED=true in production needs GITHUB_ISSUES_TOKEN (a fine-grained token with only Issues: write on GITHUB_ISSUES_REPO)',
      path: ['GITHUB_ISSUES_TOKEN'],
    },
  )

export type Env = z.infer<typeof schema>

/**
 * A blank value means "not set", for every key: Dokploy's editor and compose's `${KEY:-}` both
 * hand an empty string for an option the operator left empty, and an optional `.url()` or
 * `.min(1)` would otherwise refuse to boot on it. Required keys left blank still fail, as missing.
 */
function withoutBlanks(
  source: Record<string, string | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value.trim() === '') continue
    out[key] = value
  }
  return out
}

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(withoutBlanks(source))
  if (!result.success) {
    // Key names only, never values; a cross-key rule adds its sentence so the fix is obvious.
    const keys = result.error.issues
      .map((i) => (i.code === 'custom' ? `${i.path.join('.')} (${i.message})` : i.path.join('.')))
      .join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
}

/**
 * SOURCE OF TRUTH KEYWORDS: settingsSecret, SETTINGS_SECRET
 * WHAT:  The current SETTINGS_SECRET (signs links/tokens, encrypts provider settings).
 * WHY:   One reader instead of a `const secret = () => loadEnv(process.env).SETTINGS_SECRET`
 *        per router; read per call, not cached, so tests can swap the env. Rotation
 *        (SETTINGS_SECRET_PREVIOUS) stays with the callers that decrypt.
 * WHERE: API routers, storefront pages/actions; guarded by the duplicate-helpers sweep.
 */
export function settingsSecret(): string {
  return loadEnv(process.env).SETTINGS_SECRET
}

/**
 * The merchant Google sign-in client, or null when either key is unset: the admin then leaves
 * the provider out of Better Auth and hides "Continue with Google".
 */
export function merchantGoogleSignIn(
  env: Pick<Env, 'MERCHANT_GOOGLE_CLIENT_ID' | 'MERCHANT_GOOGLE_CLIENT_SECRET'>,
): { clientId: string; clientSecret: string } | null {
  const clientId = env.MERCHANT_GOOGLE_CLIENT_ID
  const clientSecret = env.MERCHANT_GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

const platformEmailSchema = z.object({ ...platformEmailShape, PLATFORM_DOMAINS: platformDomains })

export type PlatformEmailEnv = z.infer<typeof platformEmailSchema>

/**
 * Just the platform email keys, for code that must not require the database
 * URLs (the send path in `@commerce/core`). Throws on a malformed value.
 */
export function loadPlatformEmailEnv(source: Record<string, string | undefined>): PlatformEmailEnv {
  const result = platformEmailSchema.safeParse(source)
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
}

const backupSchema = shape.pick({
  DATABASE_URL_OWNER: true,
  NODE_ENV: true,
  BACKUP_ENCRYPTION_KEY: true,
  BACKUP_R2_ACCOUNT_ID: true,
  BACKUP_R2_ACCESS_KEY_ID: true,
  BACKUP_R2_SECRET_ACCESS_KEY: true,
  BACKUP_R2_BUCKET: true,
  BACKUP_LOCAL_DIR: true,
})

export type BackupEnv = z.infer<typeof backupSchema>

/**
 * Only what `scripts/backup-db.ts` and `scripts/restore-db.ts` read: the backup job runs as its
 * own small app and should not need the app's other secrets (SETTINGS_SECRET, REDIS_URL…) just
 * to pass the full schema. Blank values count as unset, as in `loadEnv`. Key names only in errors.
 */
export function loadBackupEnv(source: Record<string, string | undefined>): BackupEnv {
  const result = backupSchema.safeParse(withoutBlanks(source))
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
}

const aiSchema = z.object({ ...aiShape, NODE_ENV: z.string().optional() })

export type AiEnv = z.infer<typeof aiSchema>

/**
 * Just the AI engine's keys, for `@commerce/ai`, which must not require the database URLs.
 * Read per call (not cached) so tests can swap the env. Throws on a malformed value.
 */
export function loadAiEnv(source: Record<string, string | undefined>): AiEnv {
  const result = aiSchema.safeParse(source)
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
}
