# Checkout: the dark logo in system mode too

A store on the shopper's device theme has no `data-theme`, so the dark checkout logo rule never
applied. It now follows `prefers-color-scheme` like the checkout's other dark colours.

The owner preferred the earlier checkout, so the section boxes and the gateway name chips with
their marks are back. The dark logo, the rupee sign, the "UPI ID" and "Bank deposit" names and the
full-width pre-order note stay.
