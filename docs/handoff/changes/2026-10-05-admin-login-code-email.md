# Admin sign-in codes are emailed (2026-10-05)

The admin's `sendOtp` (`apps/admin/src/lib/auth.ts`) only printed the code to the log, even in
production, so merchants on the first deploy never got an email (SES showed zero sends) and the
code sat in plain text in the logs. With the platform email account configured
(`SENDER_EMAIL_PROVIDER=ses`) it now sends through `deliverPlatformLoginCode`
(`packages/core/src/accounts/deliver-code.ts`: the platform SES transport, `login_code` template,
from `PLATFORM_EMAIL_FROM`) and never logs it; a refused send fails the request. Development keeps
the printed code and the readback route. Tests: `deliver-platform-code.test.ts`.
