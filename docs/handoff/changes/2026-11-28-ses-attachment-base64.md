# Invoice PDFs sent by SES no longer arrive blank

Branch `fix/ses-attachment-base64` (from `origin/dev`). No migration.

## What changed

- `packages/notifications-ses/src/ses.ts` (`SesChannel.send`): each SES v2 attachment now sets
  `ContentTransferEncoding: 'BASE64'`. Without it SES defaults to `SEVEN_BIT`, which mangles
  binary files, so the invoice PDF arrived blank (text fine, PDF pages empty).

## Tests

- `packages/notifications-ses/test/ses.test.ts` "attaches files and prints app links" now expects
  `ContentTransferEncoding: 'BASE64'`. Package suite run here: 37/37 pass; typecheck clean.

## Left to do / for the owner to check

- Send one real invoice email from live (GST invoice -> Email to buyer) and open the PDF.
