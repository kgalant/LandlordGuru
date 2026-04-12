# Migrations

Database schema migrations. Not yet implemented.

Will use a migration tool such as [node-postgres-migrate](https://github.com/briandela/node-postgres-migrate)
or [Flyway](https://flywaydb.org/) once the backend is scaffolded.

## Naming convention

```
001_initial_schema.sql
002_add_import_batches_table.sql
003_add_reconciled_index.sql
```

## Initial schema

When phase 2 begins, the first migration will be derived from [../docs/data-model.md](../docs/data-model.md).
Key notes:
- `amount` as `NUMERIC(12,2)` — never `FLOAT`
- `type` and `category` as `VARCHAR` with CHECK constraints
- `import_batch` as a foreign key to a dedicated `import_batches` table
