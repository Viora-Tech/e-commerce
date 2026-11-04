# Checkout: the dark logo in system mode too

A store on the shopper's device theme has no `data-theme`, so the dark checkout logo rule never
applied. It now follows `prefers-color-scheme` like the checkout's other dark colours.
