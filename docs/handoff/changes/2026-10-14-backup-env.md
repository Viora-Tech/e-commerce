# Backup scripts read only their own settings

`@commerce/config` `loadBackupEnv` validates only what `scripts/backup-db.ts` and `scripts/restore-db.ts`
read: DATABASE_URL_OWNER, NODE_ENV, BACKUP_ENCRYPTION_KEY, BACKUP_R2_*, BACKUP_LOCAL_DIR.

The production `backup` app on Dokploy no longer needs DATABASE_URL, REDIS_URL or SETTINGS_SECRET.
Its start command currently exports throwaway placeholders for those three. Once a tasks image built
from this code is deployed, the command can go back to:

`sh -c bun${IFS}run${IFS}/repo/scripts/backup-db.ts;exec${IFS}sh${IFS}/repo/deploy/backup-cron.sh`
