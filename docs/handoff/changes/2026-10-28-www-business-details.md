# koomerce.app shows phone and business details (payment partner KYC)

Decentro's onboarding asked for an operational phone, email and address on the website. `siteConfig` gains `company` (legal name, registered = operational address, GSTIN) and the phone becomes +91 93550 74123. The contact page shows a Phone channel and a "Business details" block; the footer shows phone, legal name and address. Privacy and terms read the legal name and address from `siteConfig.company` instead of their own copies.
