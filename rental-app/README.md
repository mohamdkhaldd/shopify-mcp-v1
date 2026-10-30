# MK-Tech

**بالعربي في سطرين:** برنامج MK-Tech لشركات تأجير المعدات. تطبيق واحد فيه برنامجين — **التأجير** (السركي، أصحاب المعدات، العملاء، المستثمرين وتوزيع الأرباح، الضرايب) و**التشغيل** (المعدات، الشغل اليومي، الشركاء، المرتبات، الخزنة، العهد، صاحب الكوميشن). كود التفعيل بيحدد البرنامج اللي يفتح، وكل شركة ليها اسمها ولوجوها ومساحتها على السحابة. شغال على **لاب ويندوز**، **تابلت/موبايل أندرويد**، و**الويب** (آيفون وأي متصفح، وبيفتح من غير نت).

The rest is for developers.

---

## The product in one paragraph

One codebase, three targets: **Windows** (Electron + better-sqlite3), **Android** (Capacitor + sql.js in IndexedDB) and the **web** (the same Capacitor build served from GitHub Pages, with a service worker for offline). Each device keeps a full local SQLite database and works offline; changes sync through **Supabase** (one row table, per-customer `tenant_id` with RLS). An **activation code** (Supabase Edge Function, Ed25519-signed token, 14-day offline window) unlocks the app, carries the customer's name/logo, the programs it opens, its device count and its cloud login. Updates ship from the public `mohamdkhaldd/mk-tech` repo (installers, APK, web).

## Repository map

| Path | What it is |
|---|---|
| `core/calc/` | Pure money maths (no DB): integer piasters and the single rounding point, sarki days, contract month, profit split, time-weighted capital, collections. |
| `core/schema.ts` | Rental SQLite schema: integer piasters, no hard deletes, append-only money rows with reversals, closed-month locks, audit triggers. |
| `core/services/` | Everything the rental screens call: master data, sarki, ledger (every money movement + its treasury entry), `books.ts` (all derived numbers, single implementation of each rule), reports, month close, views. |
| `core/sync/` | Sync engine (outbox → Supabase `sync_rows`, realtime + polling pull, gid-based rows, merges by unique keys). Shared by laptop and tablet. |
| `core/license/` | Activation: `manager.ts` (activate / refresh / company password / sign out), `token.ts` (Ed25519 check; the app only has the public key). |
| `core/shell/` | MK-Tech shell helpers: one-time pass between programs, unsynced-changes count. |
| `src/` | Rental screens (React 18 + Tailwind). `src/components/Launcher.tsx` = activation / lock screen / program chooser. |
| `operations/` | The operations program (التشغيل), originally a separate app: `operations/src` screens, `operations/electron/{schema,ipc,extras,syncEngine}.js` its backend (CommonJS, shared by laptop and tablet). |
| `electron/` | Laptop shell: `main.ts` (which program opens, IPC, lock/sign-out, backups, updates), `operations.ts` (operations backend + one-time migration from the old "حسابات البنيان" app). |
| `tablet/` | Android/web shell: `backend.ts` replaces Electron's main process (sql.js DB, same handlers, same sync); `web/sw.js` offline copy; `android/` native bits (printer, updater, signing). |
| `cloud/` | Supabase: `functions/license` (Edge Function, source of truth), `sql/` migrations run on the project. |
| `tests/` | Vitest (≈90 tests): calculation worked examples, ledger rules, sync between two fake devices, licensing, operations migration, obligations, the 3-month example. |
| `docs/` | `LICENSES.md` + `admin-guide/` (running customers), `install-guide/` (customer PDF), `customer-sheet/` (Word sheet with the code), `test-scenario/` (3-month manual test with expected numbers), `PHASE0_DESIGN.md` (agreed business rules). |
| `.github/workflows/rental-*.yml` (repo root) | CI: Windows installer and Android APK + web build; publish to `mk-tech` (and to the legacy `albunyan-rental-releases` from branch `claude/albunyan-rental-app`). |

## Running it

```
npm ci
npm test                 # all tests on better-sqlite3 (laptop engine)
npm run test:tablet      # same tests on sql.js (tablet/web engine)
npm run typecheck        # rental + operations

npm run electron:dev     # laptop app with hot reload
RENTAL_DEMO=1 npm run electron:dev          # demo data, no activation needed
RENTAL_DEMO=1 RENTAL_PRODUCT=operations …   # open التشغيل in demo mode

npm run build:tablet     # web/Android build into dist-tablet/
PREVIEW=1 npx vite build --config vite.tablet.config.ts   # isolated preview build
```

`better-sqlite3` is compiled for one runtime at a time: `npm run rebuild:electron` before running Electron, `npm run rebuild:node` before Vitest.

## Releasing

- Branch `claude/mk-tech-suite` is the working branch. **Pushing to `claude/albunyan-rental-app` publishes** to customers (both release repos). On the working branch, publishing is manual: Actions → *Rental - Windows installer* / *Rental - Tablet (Android)* → Run workflow → `publish` (or `preview` for the web at `/mk-tech/preview/`).
- Secret `RELEASES_TOKEN` (fine-grained PAT with Contents write on `mk-tech` and `albunyan-rental-releases`).
- Version numbers come from the workflow run number (laptop `0.1.N`, tablet `1.0.N`); installed apps update themselves.

## Cloud (Supabase project "MK-Tech", ref `dbzgiaxsxadzkfqppknm`)

- `public.licenses`, `public.license_devices` — codes and devices (RLS on, no policies: only the Edge Function touches them). `password_hash` = optional company password (bcrypt).
- `licensing.*` — `activate`, `release`, `set_password`, `check_password`, per-tenant sync logins, the Ed25519 signing key (`licensing.secrets`).
- `public.sync_rows` / `public.sync_log` — synced data; `tenant_id = current_tenant()` from the JWT. Rental tenant = license id, operations tenant = −license id.
- The free plan pauses after a week idle; `.github/workflows/cloud-keepalive.yml` (on `main`) pings it daily.

## Rules worth knowing before changing anything

- Money is **integer piasters** end to end; rounding happens in one place (`core/calc/money.ts`).
- Money rows are never edited or deleted: cancelling = a reversal row. Closed months are frozen by DB triggers; corrections go in as adjustments in an open month.
- Every derived number comes from `core/services/books.ts`; screens never recompute.
- Profits are paid only from what clients actually paid (`releasable`).
- Synced rows carry a global `gid`; unique business keys (e.g. treasury account name) merge across devices.
- The activation token is signed server-side; never put the private key in the app.
