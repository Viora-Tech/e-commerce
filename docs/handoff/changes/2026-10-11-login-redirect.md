# Signed-in users skip the login page

`/login` now checks the session on the server and sends a signed-in user to the admin home (which
then picks dashboard or onboarding). Done in the page, not the proxy: a cookie-only check in the
proxy would loop (/ → /login → /) whenever a cookie is present but expired, and a real session
check in the proxy would hit the database on every page request.
