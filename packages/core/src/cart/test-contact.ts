/** SOURCE OF TRUTH: test checkout contacts — WHAT: the contact the release smoke test types at checkout (Amazon SES's mailbox simulator, never a real shopper) / WHY: its carts are left at the payment step on purpose every release, so abandoned lists, Home, Growth, AI answers and recovery sends must skip them */
import { cart } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'

/** Amazon SES's simulator domain: mail to it is accepted and dropped, so no shopper uses it. */
const TEST_CONTACT_DOMAIN = 'simulator.amazonses.com'

/** Where-clause fragment: true for carts whose contact is not a test address. */
export const notTestCartContact: SQL = sql`coalesce(${cart.email}, '') not ilike ${`%@${TEST_CONTACT_DOMAIN}`}`
