/** Copy for the Affiliates and Commissions filter panels (Apps, Affiliates). */
export const affiliateFiltersContent = {
  affiliates: {
    status: 'Status',
    program: 'Program',
    joined: 'Joined',
    earned: 'Earned',
    noResults: {
      heading: 'No affiliates match these filters',
      body: 'Try a different search or clear the filters.',
    },
  },
  commissions: {
    status: 'Status',
    source: 'From',
    affiliate: 'Affiliate',
    placed: 'Order placed',
    amount: 'Commission',
    flagged: 'Held by a fraud check',
    noResults: {
      heading: 'No commissions match these filters',
      body: 'Try a different search or clear the filters.',
    },
  },
} as const
