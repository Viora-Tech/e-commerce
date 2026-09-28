#!/usr/bin/env bun
/**
 * Invites a new merchant to sign up and create their own store.
 *
 * There is no platform admin UI yet, so this is the whole flow: run it, send
 * the printed link to the merchant. They sign in with that email (the usual
 * one-time-code login) and land on /onboarding instead of "invite-only for
 * now" - access is granted by matching their signed-in email to a live
 * invite, not by the link's token, so the link is a convenience, not a
 * secret to guard closely. Only matters when MERCHANT_SIGNUP_MODE=invite
 * (the default); with MERCHANT_SIGNUP_MODE=open anyone can already sign up.
 *
 *   bun run platform:invite owner@example.com
 *
 * Idempotent-ish: inviting the same email again cancels their older, still
 * unused invite and issues a fresh one (see createSignupInvite).
 *
 * Plans sold on the platform's own store (PLATFORM_SALES_STORE_ID, products
 * tagged `platform-plan`) are invited automatically when the order is paid;
 * see core `onboarding/plan-invites.ts`.
 */
import { loadEnv } from '@commerce/config'
import { createSignupInvite } from '@commerce/core'
import { createDb } from '@commerce/db'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email?.includes('@')) {
    console.error('Usage: bun run platform:invite <email>')
    process.exitCode = 1
    return
  }

  const env = loadEnv(process.env)
  const db = createDb(env.DATABASE_URL_OWNER)
  try {
    const invite = await createSignupInvite(db, email)
    const link = `${env.ADMIN_URL}/onboarding?invite=${invite.token}`
    console.log(`Invited ${invite.email}, expires ${invite.expiresAt.toISOString()}`)
    console.log(link)
  } finally {
    await db.$client.end()
  }
}

if (import.meta.main) {
  await main()
}
