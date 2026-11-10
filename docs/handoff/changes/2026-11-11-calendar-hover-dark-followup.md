# Calendar hover follow-up (#1440)

#1441 added hover colours for picked days, but the day button's `dark:hover:text-foreground`
(Tailwind compiles `dark:` as `:is(.dark *)`, same weight, later in the CSS) still won, so the
hovered range start/end stayed white on the light primary. Removed it: the ghost button's own
`hover:text-foreground` already covers unpicked days. Verified in the local admin: hovered range
start reads rgb(23,23,23) on rgb(229,229,229).
