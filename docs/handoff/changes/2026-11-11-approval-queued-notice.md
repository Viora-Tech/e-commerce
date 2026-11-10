# 11 Nov 2026: "Sent for approval" instead of "Could not save" (#1494)

A change a member's role sends for approval (`APPROVAL_QUEUED`) showed as a failure on most
screens: they catch every error and toast a fixed "Could not save/switch". `lib/approval-notice.ts`
now shows the "Sent for approval" notice from the API client once, and holds back the page's
own failure toast for the next 2 s, so the member sees only the notice. No screen had to change.
Test: `lib/approval-notice.test.ts`.
