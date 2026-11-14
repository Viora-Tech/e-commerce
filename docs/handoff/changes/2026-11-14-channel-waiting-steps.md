# Sales channels: "Waiting for approval" says what happens next

- A Meta or Google channel goes to "Waiting for approval" when the admin has no app keys for that
  platform (`META_APP_ID` / `META_APP_SECRET`, Google Merchant client), so sign-in cannot start.
  Nothing approves these requests.
- The channel page now shows "What happens next" under the bar (`waiting-steps.tsx`). Once the
  keys are set (`connectNow`), the card says sign-in is ready and offers **Connect now**, which
  opens the normal connect dialog and goes to Meta/Google sign-in.
