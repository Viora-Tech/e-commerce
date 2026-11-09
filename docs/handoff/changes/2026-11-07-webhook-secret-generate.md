# Generate a webhook secret when connecting Razorpay

The install flow's Connect step offers a Generate button for fields marked `generate` (new `ProviderField.generate`). Razorpay's webhook secret uses it: one click fills a random 32-character secret, shown in plain text with a copy button so the merchant can paste the same value into the Razorpay dashboard webhook.
