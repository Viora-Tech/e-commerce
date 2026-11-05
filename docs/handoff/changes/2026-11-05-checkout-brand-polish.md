# Checkout polish: real payment logos, grouped payment rows, lit cards

Payment is now one grouped list like the admin's settings pages: a logo tile, the name, what it
takes, the accepted marks, and a "2% off" pill. Logos (Razorpay, UPI, Visa, Mastercard, RuPay) are
real files built into the page as data URIs in `lib/payment-logos.ts`: no library and no image
request. GPay, PhonePe and Paytm stay drawn in type because Express is off.

Colour stays the merchant's: accent, button, radius and font still come from Checkout branding.
Only neutrals changed, in dark mode: a darker canvas and softly lit cards, after the deploy
platform. The picked row, picked radio cards and Pay's glow all read `--ck-accent` / `--ck-button`.
Courier logos are not in yet: shipping options are free text, so a name-to-logo match needs a design.
