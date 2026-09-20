-- Better Auth tables are platform-level: no RLS, but the runtime role needs access.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user", "session", "account", "verification", "organization", "member", "invitation" TO app;
