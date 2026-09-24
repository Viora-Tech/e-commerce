/** Copy for the Delhivery app (Apps → Delhivery). */
export const delhiveryAppContent = {
  connect: {
    title: 'Connect Delhivery',
    intro:
      'Your API token, client name and pickup location are on the Delhivery One dashboard under Settings › API. Use the staging URL with a staging token while testing.',
  },
  overview: {
    title: 'Delhivery',
    subtitle: 'Serviceability, pickups, tracking and NDR on your Delhivery account.',
    notConnected: 'Not connected yet. Add your account details to start booking shipments.',
    connectCta: 'Connect your account',
    connected: 'Connected',
    goToShipments: 'Open the Shipments workspace',
    goToShipmentsHelp: 'Book, track and manage every Delhivery shipment from Orders → Shipments.',
    capabilitiesHeading: 'What this app can do',
    capabilities: {
      serviceability: 'Check if a PIN code is deliverable, with an estimated delivery date',
      create_shipment: 'Book a shipment and get a waybill',
      label: 'Print the shipping label',
      pickup: 'Schedule a pickup with your local hub',
      tracking: 'Track scans automatically, a few times a day',
      webhook: 'Get near-instant tracking updates if you turn on the webhook',
      cancel: 'Cancel a shipment before it is picked up',
      ndr: 'Reattempt delivery, change the address, or send a parcel back (RTO) from the NDR queue',
      manifest: 'Not available from Delhivery yet: we print a label sheet from what you booked',
      wallet:
        'Not available from Delhivery yet: enter your balance by hand to get low-balance alerts',
    } as Record<string, string>,
    webhookUrlLabel: 'Tracking webhook URL',
    webhookUrlHelp:
      'Paste this into Delhivery One → API → Webhooks, along with the same shared secret you set on the connect page, so scans reach this app within minutes instead of waiting for the next poll.',
    copied: 'Copied',
  },
}
