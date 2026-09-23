import { z } from 'zod'

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
  /** Checks custom domains' DNS and certificates. `dev` decides from the hostname, offline. */
  DOMAIN_PROVIDER: z.enum(['dev']).default('dev'),
  /** IPv4 an apex custom domain's A record must point at. Default is a documentation address. */
  STOREFRONT_A_RECORD: z.ipv4().default('192.0.2.10'),
  /** Hostname a subdomain's CNAME must point at. */
  STOREFRONT_CNAME_TARGET: z.string().min(3).default('shops.waimers.localhost'),
  /** Comma-separated platform domains; they and their subdomains cannot be connected as custom. */
  PLATFORM_DOMAINS: z
    .string()
    .default('localhost')
    .transform((s) =>
      s
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** Dev seed: this email becomes owner of the seeded Waimers store. */
  SEED_OWNER_EMAIL: z.string().email().optional(),
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
