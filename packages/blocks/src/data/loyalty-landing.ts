/** Copy for the Loyalty landing page (`/pages/rewards`): how it works, ways to earn and redeem, referral, FAQ. */

export const loyaltyLandingContent = {
  metaTitle: (program: string) => program,
  heroLine: 'Earn points every time you shop and turn them into discounts.',
  memberLine: (points: string) => `You have ${points} to spend.`,
  seeMine: 'See my points',
  how: {
    title: 'How it works',
    steps: [
      { icon: 'user', title: 'Join', body: 'Create a free account in a few seconds.' },
      {
        icon: 'hand-coin',
        title: 'Earn',
        body: 'Collect points on orders and the other things listed below.',
      },
      { icon: 'gift', title: 'Redeem', body: 'Swap your points for a discount at checkout.' },
    ],
  },
  earnTitle: 'Ways to earn',
  redeemTitle: 'Ways to redeem',
  referTitle: 'Refer a friend',
  faq: {
    title: 'Questions',
    items: [
      {
        q: 'How do I join?',
        a: 'Sign in or create an account on this store. You are a member from then on, at no cost.',
      },
      {
        q: 'When do I get points for an order?',
        a: 'Points for an order are added once it is delivered and the return window has passed. You can see them on the way in your account.',
      },
      {
        q: 'How do I use my points?',
        a: 'Open Rewards on any page, pick a reward and claim it. You get a code, which you can apply straight from your cart.',
      },
    ],
    expiry: (months: number) => ({
      q: 'Do my points run out?',
      a:
        months > 0
          ? `Points run out ${months} ${months === 1 ? 'month' : 'months'} after you earn them. We email you before they do.`
          : 'No. Your points stay until you use them.',
    }),
  },
}
