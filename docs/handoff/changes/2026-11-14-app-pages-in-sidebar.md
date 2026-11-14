# App pages back under the open app in the main sidebar

Owner, 14 Nov 2026: the menu column inside app pages (#1675) is gone on desktop. The sidebar's
Apps group still lists the three recent apps and View more, and the app open on screen shows its
own pages nested under its row, like Orders › All orders. Phones keep the in-page menu.
Code: `apps/admin/src/components/admin-sidebar.tsx` (`withAppRows`), `apps/admin/src/components/apps/app-shell.tsx`.
