# Calendar: picked days stay readable on hover (#1440)

`packages/ui/src/components/shadcn/calendar.tsx`: the day button's `dark:hover:text-foreground`
also hit selected days, giving white text on the light green primary. Selected single days and
range start/end now keep `bg-primary text-primary-foreground` on hover (the data-attribute +
hover selector outranks the `dark:` one, which Tailwind wraps in `:where`).
