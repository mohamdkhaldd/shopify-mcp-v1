# البنيان - التأجير

Desktop app for Al Bunyan's investor-funded equipment rental. Separate product from `accounting-app/` (different appId, database and update channel).

## Layout

- `core/calc/` pure calculation (no database): money & the single rounding point, sarki days, contract month, profit split, time-weighted capital, collections.
- `core/schema.ts` SQLite schema: integer piasters, no deletes, append-only money rows with reversals, closed-month locks, audit log triggers.
- `core/services/` everything the screens call: master data, sarki, ledger (money in/out + treasury), books (all derived numbers), reports, month close.
- `tests/` Vitest. `workedExample.test.ts` reproduces the brief's example to the piaster.
- `mockups/index.html` phase-1 static mockups.
- `docs/PHASE0_DESIGN.md` agreed rules and decisions.

## Commands

```
npm install
npm test          # all calculation + database tests
npm run typecheck
```
