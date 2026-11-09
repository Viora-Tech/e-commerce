# Product facets read distinct values

`products.facets` (the product page's vendor, type and tag suggestions and the Products list
filters) read every product's vendor, type and tags and de-duplicated them in JavaScript, then ran
its other three reads one after another. Postgres now returns only the distinct values
(`select distinct`, `unnest(tags)`), and the six reads go out together. Same answer, same sort.
No migration.
