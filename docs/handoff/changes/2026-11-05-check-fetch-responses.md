# Failed requests are now treated as failed

React Doctor's `no-fetch-response-used-without-status-check` named eight places that read a `fetch` body without checking the status.

Real problems, now fixed:

- `review-card.tsx`: a failed "helpful" vote still showed "Thanks!" and the higher count. The vote now rolls back, the button works again, and the shopper sees `helpfulFailed` (`data/reviews-widget.ts`). Rate limiting counts as a failed vote.
- `webgl-globe-canvas.tsx`: a 404 for the border points was decoded as if it were the data. It now goes to the existing "no dashes" path and logs a warning.
- `apps/www/worker/index.ts`: a Turnstile outage looked the same as a bad token. It still answers "try again", and now logs the status.

Already safe, `res.ok` added so the check is plain to read: `review-form.tsx`, `review-photo-input.tsx`, `product-questions.tsx`, `chat-widget.tsx`, `apps/www/src/lib/submit-form.ts`. Each already showed its error message. The review form and questions form keep their specific messages from a 422.

The review components live in `packages/blocks/src/components/reviews/`, not `packages/plugin-reviews`.
