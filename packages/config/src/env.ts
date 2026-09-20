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
  /** Encrypts gateway credentials stored in store settings. */
  SETTINGS_SECRET: z.string().min(16).default('dev-only-settings-secret'),
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
