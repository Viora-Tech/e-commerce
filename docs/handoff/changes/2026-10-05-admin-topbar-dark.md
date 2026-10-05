# Admin top bar: dark mode and polish

- The top-right cluster (bell, theme switch, avatar) stays on `bg-card` in dark mode instead of
  `bg-secondary`, so it no longer reads as a grey slab against the dark top bar.
- Theme switch: neutral track (`bg-secondary` / `dark:bg-input`), inset ring, knob inverts in dark
  (`dark:bg-ink-strong`), strong ease-out curve.
- Bell: rounded-lg hover on `bg-accent`, focus ring, 0.96 press scale.
- Avatar: accent-tinted (`bg-primary-soft text-primary`), falls back to the email's initials when
  there is no name.
- File: `apps/admin/src/components/layout/top-bar.tsx`. Reviewed by the owner on localhost:3200.
