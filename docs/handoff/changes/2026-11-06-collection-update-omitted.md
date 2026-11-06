# Collection saves keep what they leave out

`collections.update` used to blank every optional field the save did not send, such as the image. A left-out field now stays as it was, and `null` still clears it.

Fixes #1186.
