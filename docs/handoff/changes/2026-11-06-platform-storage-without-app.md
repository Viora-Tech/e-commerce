# Every store uses the platform bucket without an app

Stores that had not installed the R2 app saved files to the server's disk, with no error. The env defaults picked `r2`, but `registriesForStore` only held installed apps, so `resolveStorageProvider` fell back to the local folder.

- `storageRegistryFor`: a store on the platform bucket resolves against every provider. A merchant's own bucket still needs its installed app.
- `effectiveStorageSettings`: saved settings with nothing enabled now mean "no choice", so turning off a merchant bucket returns the store to the platform bucket.
- `installedStorage`: the storage settings, connection test and move-files actions still see installed apps only, so platform bucket details are not offered as a form.

Files already on the server's disk are not moved by this change.
