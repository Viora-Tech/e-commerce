# Test mode banner keeps the page's side gutter

The admin-wide "Test mode — payments are not real." strip (`components/layout/payments-test-banner.tsx`) ran edge to edge against the sidebar while the page below it is inset. It now has the same side margin as the page body (`mx-4 md:mx-6`, `w-auto`). Owner screenshot, 23 Nov.
