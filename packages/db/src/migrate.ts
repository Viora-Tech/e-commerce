import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function runMigrations(ownerUrl: string): Promise<void> {
  const sql = postgres(ownerUrl, { max: 1, onnotice: () => {} })
  try {
    const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))
    await migrate(drizzle(sql), { migrationsFolder })
  } finally {
    await sql.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await runMigrations(url)
  console.log('migrations applied')
}
