/** The customer page's Loyalty card, v2 part: tier, lifetime points, rewards taken, referrals. */
export const loyaltyCustomerContent = {
  tier: 'Tier',
  noTier: 'No tier yet',
  toNext: (what: string, tier: string) => `${what} more to ${tier}`,
  lifetime: 'Lifetime points',
  rewards: 'Rewards redeemed',
  noRewards: 'No rewards redeemed yet.',
  statuses: {
    issued: 'Not used',
    used: 'Used',
    cancelled: 'Cancelled',
    expired: 'Ran out',
  } as Record<string, string>,
  via: { tier: 'Tier reward', referral: 'Referral', redeem: '' } as Record<string, string>,
  cancel: 'Cancel code (refund points)',
  cancelTitle: 'Cancel this code?',
  cancelBody: (points: string) =>
    `The code stops working and ${points} go back to the customer, lasting from today.`,
  cancelled: 'Code cancelled, points refunded',
  cancelFailed: 'Could not cancel the code. Try again.',
  referral: 'Referral code',
  referralCount: (n: number) => (n === 1 ? '1 friend referred' : `${n} friends referred`),
  points: (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`,
}
