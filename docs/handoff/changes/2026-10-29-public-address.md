# The website shows the city, not the street address

Branch `fix/public-address`. The registered address is also the owner's home and warehouse, so
the site (Contact page, footer, Privacy Policy grievance line) now shows only
`siteConfig.company.publicAddress` ("Sonipat, Haryana, India"). The full `company.address`
stays in `packages/config/src/site.ts` for GST invoices, where the law needs it.
