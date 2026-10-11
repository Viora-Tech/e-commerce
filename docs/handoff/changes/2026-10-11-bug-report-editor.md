# Report a bug in the theme editor too

The floating "Report a bug" button was only mounted by the admin shell, so it was missing in the theme
editor (its own full-screen layout). `BugReportHost` takes `placement: 'frame' | 'screen'`; the editor
layout mounts it with `screen` (fixed, bottom-right, clear of the left rail) when `BUG_REPORTS_ENABLED`
and a store is active. Onboarding stays without it (no store yet, and the report API is store-scoped).
