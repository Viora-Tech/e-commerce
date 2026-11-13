# App bar extras cached for a minute (13 Nov 2026)

`store.shell` asked every installed app with an `appBar` read for its status pill and page counts
on every admin page (3 statements each: savepoint, select, release; 6 for Waimers' GST invoices
and Delhivery). `installedAppBars` now keeps each app's answer per store for 60 s in the process.
The read may hide a count from members without a permission, so an entry remembers each
permission the read asked about and is reused only for a member who gets the same answers. A
failed read is not remembered. Capped at 500 entries, oldest first.
