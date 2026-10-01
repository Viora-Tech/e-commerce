import { safeEqual } from '@commerce/payments'

/**
 * Constant-time string comparison for courier webhook secrets and signatures. The one
 * implementation is `safeEqual` in `@commerce/payments`; this keeps the courier-facing
 * name so every courier adapter (Delhivery, Shiprocket, ...) imports it from its own
 * contract package instead of hand-rolling `!==`.
 */
export const timingSafeEqualString: (a: string, b: string) => boolean = safeEqual
