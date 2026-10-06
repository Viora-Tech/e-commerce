# Theme dialogs: width actually applies

- Import theme, Add theme and Save section dialogs set `max-w-…` but the shared DialogContent
  caps width with `sm:max-w-sm`, which wins at sm and up, so the dialogs stayed narrow and their
  content overflowed on the right. They now use `sm:max-w-…`.
