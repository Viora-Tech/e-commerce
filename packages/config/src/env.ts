import { z } from 'zod'

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
  PLATFORM_EMAIL_NAME: z.string().min(1).default('Waimers'),
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

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_OWNER: z.string().url(),
  REDIS_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  /** Better Auth signing secret. Required by the admin app only. */
  AUTH_SECRET: z.string().min(32).optional(),
  /** Public URL of the admin app, used as Better Auth's baseURL. */
  ADMIN_URL: z.string().url().default('http://localhost:3200'),
  /** Public URL of the storefront, used for links inside notifications. */
  STOREFRONT_URL: z.string().url().default('http://localhost:3100'),
  /** Encrypts gateway credentials stored in store settings. */
  SETTINGS_SECRET: z.string().min(16).default('dev-only-settings-secret'),
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
   * Razorpay Technology Partner OAuth app ("Connect Razorpay"). Both set turns
   * the one-click connect button on; unset, merchants paste API keys instead.
   * The app's redirect URL must be `<ADMIN_URL>/api/apps/razorpay/oauth/callback`.
   */
  RAZORPAY_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  RAZORPAY_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  /** Checks custom domains' DNS and certificates. `dev` decides from the hostname, offline. */
  DOMAIN_PROVIDER: z.enum(['dev']).default('dev'),
  /** IPv4 an apex custom domain's A record must point at. Default is a documentation address. */
  STOREFRONT_A_RECORD: z.ipv4().default('192.0.2.10'),
  /** Hostname a subdomain's CNAME must point at. */
  STOREFRONT_CNAME_TARGET: z.string().min(3).default('shops.waimers.localhost'),
  PLATFORM_DOMAINS: platformDomains,
  /** Dev seed: this email becomes owner of the seeded Waimers store. */
  SEED_OWNER_EMAIL: z.string().email().optional(),
  /**
   * Who may sign up and create their own store. `invite` (default): only
   * emails with a live `bun run platform:invite <email>` invite. `open`:
   * anyone who signs in with no store yet can create one. Never affects
   * staff invitations to an existing store, which always work.
   */
  MERCHANT_SIGNUP_MODE: z.enum(['invite', 'open']).default('invite'),
  /** `<slug>.<PLATFORM_STORE_DOMAIN>` becomes a new store's primary domain. */
  PLATFORM_STORE_DOMAIN: z.string().min(1).default('waimers.store'),
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
})

export type Env = z.infer<typeof schema>

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid environment: ${keys}`)
  }
  return result.data
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
