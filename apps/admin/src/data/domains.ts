/** Copy for Settings → Domains. */
export const domainsContent = {
  title: 'Domains',
  intro:
    'The addresses your online store answers on. Shoppers on any other domain are sent to your primary one.',
  connect: 'Connect existing domain',
  primary: {
    heading: 'Primary domain',
    body: 'Shoppers see this domain in the address bar, in emails and in search results.',
    none: 'No primary domain is live yet.',
    change: 'Change primary domain',
  },
  list: {
    heading: 'All domains',
    columns: { domain: 'Domain', status: 'Status', traffic: 'Traffic' },
    platform: 'Included with your store',
    manage: 'Manage',
    redirects: 'Redirects to primary',
    serves: 'Serves the store',
    isPrimary: 'Primary',
  },
  empty: {
    heading: 'Use your own domain',
    body: 'Connect a domain you already own, like yourbrand.in, so shoppers find you at your own address. You keep it with your registrar; we only need two DNS records.',
    action: 'Connect existing domain',
  },
  status: {
    connected: 'Connected',
    pending: 'Pending verification',
    failed: 'Needs attention',
    sslPending: 'SSL pending',
    sslIssuing: 'Issuing SSL',
    sslFailed: 'SSL failed',
  },
  dialog: {
    title: 'Connect existing domain',
    body: 'Enter a domain you own. You add the DNS records at your registrar (GoDaddy, Hostinger, BigRock, Cloudflare) on the next screen.',
    label: 'Domain',
    placeholder: 'yourbrand.in',
    twin: (twin: string) => `Also connect ${twin} and send its visitors here`,
    cancel: 'Cancel',
    submit: 'Next',
    connected: (host: string) => `${host} added. Add the DNS records to finish connecting.`,
    failed: 'Could not connect that domain',
  },
  detail: {
    back: 'Domains',
    records: {
      heading: 'DNS records',
      body: 'Sign in to your domain registrar and add these records. Changes usually take a few minutes, sometimes up to 48 hours.',
      columns: { type: 'Type', name: 'Name', value: 'Value' },
      routing: 'Points the domain at your store',
      verification: 'Proves you own the domain',
      found: 'Found at your registrar',
      noneFound: 'We have not seen these records yet.',
    },
    verification: {
      heading: 'Connection',
      pending:
        'Waiting for the DNS records. We check every few minutes, and this page refreshes on its own.',
      failed: 'The records we found do not match. Fix them at your registrar, then verify again.',
      connected: 'This domain points at your store.',
      checked: (when: string) => `Last checked ${when}`,
      never: 'Not checked yet',
      verify: 'Verify connection',
      verifying: 'Checking',
      verified: 'Domain connected',
      stillPending: 'Records not found yet. We will keep checking.',
    },
    ssl: {
      heading: 'SSL certificate',
      pending: 'A free certificate is issued as soon as the domain is connected.',
      active: 'Secured with a free SSL certificate. Shoppers see the padlock.',
      failed: 'The certificate could not be issued. Check the DNS records, then verify again.',
    },
    traffic: {
      heading: 'Traffic',
      redirectLabel: 'Redirect to primary domain',
      redirectHelp: (primary: string | null) =>
        primary
          ? `Visitors to this domain are sent to ${primary}, keeping the page they asked for.`
          : 'Visitors are sent to the primary domain, keeping the page they asked for.',
      primaryHelp: 'This is your primary domain. Other domains that redirect send visitors here.',
      saved: 'Traffic setting saved',
    },
    makePrimary: 'Set as primary',
    madePrimary: (host: string) => `${host} is now your primary domain`,
    primaryHelpShort: 'Make this the address shoppers land on and see in search results.',
    primaryBlocked: 'Available once the domain is connected and its SSL certificate is active.',
    remove: 'Remove domain',
    removeTitle: (host: string) => `Remove ${host}?`,
    removeBody:
      'The domain stops showing your store straight away. You can connect it again later; you will need the same DNS records.',
    removeConfirm: 'Remove',
    removeCancel: 'Cancel',
    removed: (host: string) => `${host} removed`,
    platformNote: 'This domain comes with your store and cannot be removed.',
    primaryNote: 'Choose another primary domain before removing this one.',
  },
  errors: {
    load: 'Could not load domains',
    action: 'Something went wrong. Try again.',
  },
} as const

/**
 * The security-certificate step after a domain is connected: we add the domain to our
 * server, then the free certificate is issued. Translated in `data/hi/domains.ts`.
 */
export const domainCertificateContent = {
  issuing: 'Getting your security certificate. This can take a few minutes.',
  retrying:
    'Getting your security certificate is taking longer than usual. We keep trying on our own. If it is not done in an hour, contact support.',
} as const
