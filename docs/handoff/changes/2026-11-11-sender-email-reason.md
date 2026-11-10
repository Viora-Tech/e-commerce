# Sender email: provider reason logged, back link first (#1452)

- `packages/api/src/routers/notifications.ts`: a `provider_failed` SenderEmailError now logs
  `sender email provider failed` with the provider's message (e.g. missing `SES_*` keys, or SES's
  refusal). The card's wording is unchanged.
- `notifications-page.tsx`: the status line shows only on the page's first screen; inside a row
  the "‹ Notifications" back link comes first, like other settings pages.
