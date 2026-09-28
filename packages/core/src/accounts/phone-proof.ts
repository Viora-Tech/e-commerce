/** SOURCE OF TRUTH: which customer a proven phone number signs in as — WHAT: phone sign-in (a code or Truecaller) only lands on a customer whose phone was itself proven, or who has no email / WHY: checkout, the profile form and staff edits store a phone nobody proved, so matching on those would let anyone who typed a victim's email with their own number at checkout sign in as the victim */

export type PhoneSignInCandidate = {
  id: string
  email: string | null
  phoneVerifiedAt: Date | null
}

/**
 * May a shopper who just proved this phone sign in as this customer? Yes when the phone on
 * the row was proven before, or when the row has no email: a phone-only customer exists
 * only through phone sign-in or a phone-only checkout, so the phone is all it has.
 */
function mayUsePhoneForSignIn(row: PhoneSignInCandidate): boolean {
  return row.phoneVerifiedAt !== null || row.email === null
}

/** The newest customer (rows arrive newest first) a proven phone may sign in as, if any. */
export function phoneSignInMatch(rows: PhoneSignInCandidate[]): PhoneSignInCandidate | undefined {
  return rows.find(mayUsePhoneForSignIn)
}
