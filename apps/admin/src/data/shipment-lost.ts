/** Copy for lost parcels on Shipments: Mark as lost, Reship, the courier claim, "Check with courier". */
export const shipmentLostContent = {
  /** A parcel on its way with no new scan for a week (STUCK_DAYS). */
  stuck: (days: number) => `Check with courier · ${days} days no scan`,
  menu: {
    markLost: 'Mark as lost',
    reship: 'Reship',
    claim: 'Courier claim',
  },
  markLost: {
    title: (waybill: string) => `Mark AWB ${waybill} as lost?`,
    body: 'Do this when the courier tells you the parcel is lost. It moves to the Lost tab, where you reship it and track the claim. If the courier finds it later, its tracking moves it on.',
    confirm: 'Mark as lost',
    keep: 'Keep it',
    done: 'Marked as lost. Reship it from the Lost tab.',
  },
  reship: {
    title: (waybill: string) => `Reship lost AWB ${waybill}?`,
    body: 'The same order goes back to To ship to book a new label, with any courier. No new sale and no new invoice. The items in the lost box leave stock again, because you pack a new box.',
    confirm: 'Reship',
    keep: 'Not now',
    done: 'Back in To ship. Book the new label from there.',
  },
  claim: {
    title: (waybill: string) => `Courier claim · AWB ${waybill}`,
    body: 'Keep the claim you raise with the courier for this lost parcel.',
    status: 'Claim status',
    statuses: {
      not_filed: 'Not filed',
      filed: 'Filed',
      paid: 'Paid',
      rejected: 'Rejected',
    } as Record<string, string>,
    amount: 'Amount (₹)',
    amountHelp:
      'What you claim, or what the courier paid once it is paid. Filled with what the courier should pay, when its terms are known.',
    note: 'Claim number or note',
    save: 'Save claim',
    cancel: 'Cancel',
    saved: 'Claim saved',
  },
  /** Under the Lost chip in the list. */
  claimLine: (status: string, amount: string | null) =>
    amount ? `Claim ${status.toLowerCase()} · ${amount}` : `Claim ${status.toLowerCase()}`,
  reshipped: 'Reshipped',
  failed: 'That did not go through. Try again in a moment.',
}
