import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Liveness/readiness probe for the production Docker image (see
 * apps/admin/Dockerfile's HEALTHCHECK and deploy/docker-compose.prod.yml).
 * Checks only the database — the admin app has no other hard dependency at
 * request time (Redis is the worker's job). Never cached, never behind auth.
 */
export async function GET() {
  const dbOk = await db()
    .execute(sql`select 1`)
    .then(() => true)
    .catch(() => false)

  return NextResponse.json({ ok: dbOk, db: dbOk }, { status: dbOk ? 200 : 503 })
}
