# ShipGlobal: show what ShipGlobal actually answered (#1434)

Test connection said "did not accept this API username or password" for any 401/403. Now:
- a JSON refusal (EA_401) keeps that message and adds ShipGlobal's own words, e.g.
  `ShipGlobal answered HTTP 401 EA_401: "Authorization Failed, Invalid Username/Password Combination"`;
- a 401/403 with no JSON (a firewall or proxy page) says our request was turned away, not the login.

Checks: shipping-shipglobal 31 tests (2 new), typecheck and Biome clean.
