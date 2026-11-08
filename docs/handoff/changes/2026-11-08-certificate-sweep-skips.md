# Certificate sweep leaves out Cloudflare and unrouted rows (8 Nov 2026)

`runCertificateSweep` filters rows `checkCertificate` would skip (`notOurs`: not routable, or `edgeRecords` set) before the due check. They never got `sslCheckedAt`, so they were counted and logged as checked every minute.
