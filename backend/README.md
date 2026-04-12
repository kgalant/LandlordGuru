# Backend

Not yet implemented. See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the migration plan.

## Intended stack

- **Runtime:** Node.js
- **Framework:** Express (or Fastify)
- **Database:** PostgreSQL
- **Auth:** JWT
- **Schema:** managed via `../migrations/`

## Planned structure

```
backend/
├── package.json
├── src/
│   ├── index.js              Entry point
│   ├── routes/
│   │   ├── apartments.js
│   │   ├── transactions.js
│   │   ├── rules.js
│   │   └── reports.js
│   ├── db/
│   │   ├── client.js         PostgreSQL connection pool
│   │   └── queries/          One file per entity
│   └── middleware/
│       ├── auth.js
│       └── validate.js
└── .env.example
```
