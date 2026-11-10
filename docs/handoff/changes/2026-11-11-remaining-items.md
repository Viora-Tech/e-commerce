# 11 Nov 2026: the rest of the owner's list

- **RapidShyp at checkout:** with nothing cached for a PIN code, a courier app gets up to 2.5 s
  (was 0.8 s), so slow apps are no longer dropped for the first shopper there; cached answers
  keep the short deadline and the background refresh (`quotes.ts`).
- **Storefront limits:** the store password page (10 tries / 10 min / visitor and store), the
  checkout GST preview (60 / min) and wishlist cards (30 / min) are rate-limited.
- **Courier panel bookings:** Ship it yourself asks which connected courier app the AWB was
  booked in; the shipment is saved under that app's id, so tracking polls and webhooks update
  it. Manual by the owner's choice (no polling of courier panels).
- **#1314 Customize slow:** an imported theme's editor info loads with the page, so the canvas
  render starts on first paint (it waited ~4 s for the editor to start, then 2.1 s for the info).
- **Hero video posters:** a hero video's poster uses the WebP variant up to 1920 px, not the
  original file. Waimers' hero videos have no poster set yet (Customize › hero › each slide).

Store changes made through the MCP (not code): the two "Asia" shipping zones renamed "India",
rates unchanged.
