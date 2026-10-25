# Storage Test connection also checks browser uploads (CORS)

The credential check passed while every browser upload failed, because the R2 bucket had no CORS rule
for the admin origin. Test connection / Verify now presign a 1-byte upload and send the browser's
preflight (Origin = ADMIN_URL) to the bucket; if it isn't allowed, the result says so and shows the
exact CORS rule to paste. Local/same-origin uploads skip the check; a failing check never blocks.
