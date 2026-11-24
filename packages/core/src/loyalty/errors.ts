/** SOURCE OF TRUTH: Loyalty v2 refusals — WHAT: `LoyaltyError` with a stable code (not_found, invalid, insufficient, not_eligible, limit_reached, closed, used) / WHY: the API maps each code to one answer and the storefront narrows on the code, never on message text */
import { CommerceError } from '../errors'

export type LoyaltyErrorReason =
  | 'not_found'
  | 'invalid'
  | 'insufficient'
  | 'not_eligible'
  | 'limit_reached'
  | 'closed'
  | 'used'

export class LoyaltyError extends CommerceError {
  constructor(
    readonly reason: LoyaltyErrorReason,
    message: string,
    storeId?: string,
  ) {
    super(`LOYALTY_${reason.toUpperCase()}`, message, { storeId })
  }
}
