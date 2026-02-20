# File: `db/migrations/0012_steady_signal.sql`

## Purpose
Finalizes the batch claim function by removing residual PL/pgSQL `user_id` ambiguity.

## Function Update
- keeps due-bucket filtering and lockstep CTE structure
- changes upsert conflict clause to:
  - `ON CONFLICT ON CONSTRAINT cron_selection_leases_pkey`
- returns lease ids as `leased_user_id` from the CTE and joins on that alias

## Rationale
- avoids ambiguity between output parameter `user_id` and SQL identifiers in the upsert section
- stabilizes execution across integration tests and direct SQL calls
