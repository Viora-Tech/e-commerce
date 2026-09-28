# EMI & pay later app

**EMI & pay later app** (27 September 2026, `feat/emi-widget-app`): built-in app
`emi-pay-later` (`packages/plugin-emi`) puts "or ₹X/month with EMI or pay later" under the
product price and adds an **EMI offers** app block. Settings (on/off, Razorpay or Cashfree,
lowest price) live in `store.apps.settings['emi-pay-later']` via new
`appSettingsOf`/`withAppSettings` in `@commerce/core` (no migration). Shows only when the
gateway is enabled and EMI is on at checkout. With Razorpay it loads Razorpay's official
Affordability Widget script (public key id only), falling back to the `@commerce/core/emi`
line when the script fails, in dark theme, or when another block holds the widget. Stores
without the app keep the old `EmiHint`. Admin: Apps → EMI & pay later.
