/** SOURCE OF TRUTH: signup waitlist — WHAT records people asking to join while signups are invite-only (email, phone, what they sell) / WHY invite mode should collect interest instead of turning people away */
import { type Db, newId, signupWaitlist } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

export const WaitlistEntrySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 -]{8,16}$/),
  sells: z.string().trim().min(2).max(300),
})
export type WaitlistEntry = z.infer<typeof WaitlistEntrySchema>

/**
 * Adds `entry` to the waitlist, or refreshes the phone and answer when the
 * email is already on it (joining twice is harmless, never an error).
 */
export async function joinSignupWaitlist(
  db: Db,
  entry: WaitlistEntry,
  opts: { userId?: string | null } = {},
): Promise<void> {
  const parsed = WaitlistEntrySchema.parse(entry)
  await db
    .insert(signupWaitlist)
    .values({ id: newId(), ...parsed, userId: opts.userId ?? null })
    .onConflictDoUpdate({
      target: signupWaitlist.email,
      set: {
        phone: parsed.phone,
        sells: parsed.sells,
        userId: sql`coalesce(excluded.user_id, ${signupWaitlist.userId})`,
        updatedAt: new Date(),
      },
    })
}
