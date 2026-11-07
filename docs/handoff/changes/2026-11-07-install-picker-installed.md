# App install: the store picker shows where the app already is

When a member of several stores installs an app, the store picker now marks stores that already have it as Installed, and their button says "Open in <store>" instead of "Install in <store>". Choosing one opens the app, as it did before.

Adds `account.storesWithApp`, which only reads the member's own stores.
