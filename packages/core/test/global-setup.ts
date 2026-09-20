import { runMigrations } from '@commerce/db'

export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER missing; is .env.test loaded?')
  await runMigrations(url)
}
