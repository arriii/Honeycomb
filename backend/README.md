# Future Backend

The current website is intentionally static.

A later backend should expose endpoints such as:

```text
POST /auth/signup
POST /auth/login
GET  /profile
PUT  /profile
POST /records
POST /scan
POST /chat
GET  /report
DELETE /account
```

The server should hold all AI/API secrets. Never place a private API key in browser JavaScript or a public GitHub repo.
