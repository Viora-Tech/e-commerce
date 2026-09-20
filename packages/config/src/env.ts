import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_OWNER: z.string().url(),
  REDIS_URL: z.string().url(),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
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
