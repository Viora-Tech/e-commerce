# Sidebar store switcher works again (2026-10-25)

`apps/admin/src/components/admin-sidebar.tsx`: picking a store in the top-left switcher did nothing — the item used Radix's `onSelect`, which Base UI's `Menu.Item` ignores. It now uses `onClick`.
