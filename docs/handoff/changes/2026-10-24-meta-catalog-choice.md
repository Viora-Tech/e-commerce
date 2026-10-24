# Meta connect: never guess another store's catalog

Facebook Login for Business uses one business integration per Meta business. Every store on the
same business therefore sees every catalog shared with it, including ones other stores connected.
`sharedCatalog` used to fall back to the first shared catalog when no name matched. A second store
(the Claw Gears demo) could then have synced into Waimers' live catalog.

Now it picks this store's current catalog (kept on a reconnect), else the one named
`<Store> (Koomerce)`, else the only one shared. With several shared and no match, it refuses and
says which name to give the catalog. Tests: `meta-discover.test.ts`.
