# SavdoPilot AI — Backend Setup

Production-oriented backend for the existing React + Vite frontend: Vercel
Serverless Functions (Node runtime, TypeScript) + Supabase Postgres + Firebase
Auth + Zod. The frontend, its routing and its UI are untouched; the backend is
additive.

---

## 1. Architecture

```
Browser (React/Vite SPA)
  │  Firebase ID token in  Authorization: Bearer <token>
  ▼
Vercel Serverless Functions  (api/, Node runtime)
  │  1. CORS (allow-list)      4. Firebase Admin: verifyIdToken
  │  2. method + body/query    5. tenant resolution (organizations/members)
  │     validation (Zod)       6. rate limit + handler
  ▼
Supabase Postgres  (service role → RLS is bypassed; the API enforces tenancy)
  ▲
Payment providers (Click / Payme / Uzum / Stripe) call the webhook endpoints
```

Key rules:

- The API never trusts a client-supplied user id. The caller is identified only
  by their verified Firebase token (`req.user.uid`).
- The API never trusts a client-supplied organization: the organization is
  resolved from `organization_members` for that Firebase uid, and an explicit
  `organizationId` is accepted only if the caller is a member of it.
- Client-supplied totals, invoice status `paid`, `organization_id` columns and
  similar are impossible to send: every schema is a Zod `strictObject`, so
  unknown keys are rejected (422).
- Missing configuration fails **closed** with `503` — there is no development
  auth bypass and no "pretend" success.

Directory layout:

```
api/
  health.ts                     GET  /api/health
  auth/session.ts               POST /api/auth/session
  customers/index.ts            GET|POST /api/customers
  customers/[id].ts             GET|PATCH|DELETE /api/customers/:id
  sales/index.ts                GET|POST /api/sales
  sales/[id].ts                 GET|PATCH /api/sales/:id
  invoices/index.ts             GET|POST /api/invoices
  invoices/[id].ts              GET|PATCH /api/invoices/:id
  ai/chat.ts                    POST /api/ai/chat
  ai/message.ts                 POST /api/ai/message
  ai/insights.ts                POST /api/ai/insights
  ai/reminder.ts                POST /api/ai/reminder
  payments/[provider]/webhook.ts POST /api/payments/:provider/webhook
  _lib/                         shared server modules (NOT routed as functions)
supabase/migrations/            0001_init.sql … 0004_hardening.sql
tests/api/                      node:test suites for the shared pipeline
```

`api/_lib/**` is never exposed as a route: Vercel only turns files with a
default export into functions, and the folder is prefixed with `_`.

---

## 2. Prerequisites

- Node.js 20+ (verified on Node 24), npm.
- A Supabase project (Postgres 15+).
- A Firebase project with Authentication enabled (email/password + Google).
- Optional: Vercel CLI (`npm i -g vercel`) for local function testing.

---

## 3. Environment variables

Copy `.env.example` to `.env` (git-ignored) and fill it in.

**Public — safe in the browser, inlined at build time (`VITE_` prefix):**

| Variable | Purpose |
| --- | --- |
| `VITE_USE_DEMO_MODE` | `true` = seeded local demo data, `false` = real backend |
| `VITE_FIREBASE_*` | Firebase web config (see `FIREBASE_SETUP.md`) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Optional client access; RLS denies all |
| `VITE_APP_URL`, `VITE_APP_NAME` | App metadata |
| `VITE_API_BASE_URL` | Empty = same origin. Set only if the API lives on another host |

**Server-only — never prefix with `VITE_`, never commit:**

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS. Must stay server-side |
| `FIREBASE_SERVICE_ACCOUNT` | Service-account JSON on one line, or its base64 (required for auth) |
| `FIREBASE_PROJECT_ID` | Optional cross-check of the service account's `project_id` (falls back to `VITE_FIREBASE_PROJECT_ID`). A mismatch is reported by `/api/health` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS |
| `APP_URL` | Fallback origin when `ALLOWED_ORIGINS` is empty |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL` | AI provider |
| `OMNIROUTE_API_KEY`, `OMNIROUTE_API_BASE_URL` | Used when `AI_PROVIDER=omniroute` |
| `AI_DAILY_LIMIT_PER_ORG` | Hard daily cap per organization (default 200) |
| `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`, `PAYME_KEY`, `UZUM_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Provider credentials, one set per enabled provider (empty = "not connected"). Merchant ids are not read because the webhook identifies the invoice from the callback itself |

Any value that still looks like the template placeholder (`your-…`,
`your-project.…`, `your-domain.…`, `CHANGEME`) or an empty string is read as
*not configured*, so a half-filled `.env` can never silently enable something.

`SUPABASE_URL` must be `https://` unless it points at loopback. The service role
key bypasses RLS, so a plaintext connection to a remote host is a full tenant
compromise; `api/_lib/env.ts` refuses it and `/api/health` reports
`database: "invalid_url"`.

Vite only bundles files reachable from `src/main.tsx`; `api/_lib/env.ts` reads
`process.env` and is not imported from `src/`, so no server value can reach the
bundle. This is verified with a grep of `dist/` (section 9).

---

## 4. Database migrations

Four ordered SQL files in `supabase/migrations/`. Apply them in order, and
never skip one:

```bash
# Option A — Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — SQL editor: paste 0001, then 0002, then 0003, then 0004
```

**Never run these against a database you have not configured, and do not run
them automatically at deploy time.**

`0001_init.sql` — 13 tables, all with uuid primary keys, `created_at` /
`updated_at` timestamps, foreign keys and indexes:

`users`, `organizations`, `organization_members`, `customers`, `leads`,
`conversations`, `sales`, `invoices`, `invoice_items`, `payments`,
`subscriptions`, `usage_records`, `ai_interactions`.

`0002_rls.sql` — enables **and forces** Row Level Security on every table and
revokes all privileges from the `anon` and `authenticated` roles. There are no
permissive policies: a request made with the anon key gets nothing. The API uses
the service role and is therefore the single enforcement point; RLS is the
defence-in-depth layer that stops a leaked anon key from reading tenant data.
The file also contains a commented template for per-tenant policies if you later
want to query Supabase directly from the browser.

`0003_functions.sql` — the three atomic SQL functions the API relies on:

| Function | Guarantees |
| --- | --- |
| `bootstrap_account` | Creates `users` + `organizations` + membership once, idempotently |
| `create_invoice_with_items` | Invoice header and line items in one transaction; totals computed in SQL |
| `record_payment` | Unique per `(provider, provider_payment_id)` → duplicate callbacks are no-ops; `pending`/`failed` may advance to `succeeded` (Payme's create-then-perform flow); an already settled row reports `state_conflict` and is never downgraded; recomputes `amount_paid` and flips the invoice to `paid` only when fully covered |

### 4.1 Create the Supabase project

1. <https://supabase.com/dashboard> → **New project**. Pick the region closest to
   your users, set a strong database password and store it in a password
   manager. It never goes in this repository.
2. **Project Settings → API**: copy the *Project URL* to `SUPABASE_URL` and the
   `service_role` key to `SUPABASE_SERVICE_ROLE_KEY`.
3. **Never** put the `service_role` key in the browser, in a `VITE_` variable,
   in `VITE_SUPABASE_ANON_KEY`, or in a commit. The anon key is safe to publish
   only because RLS denies everything (section 4.3).
4. The project can be used by the API immediately after the migrations run; no
   other Supabase feature (Auth, Storage, Realtime) is required.

### 4.2 Apply the migrations safely

Preconditions: an **empty** Supabase project, a database backup (section 4.5),
and one person performing the steps. Do not run these against production
without explicit sign-off.

**Apply as `postgres`** — that is what the SQL editor and `supabase db push`
already use. Migrations are applied once; do not edit a migration that has been
applied to a database other people already use — add a new one.

```bash
# 1. Back up first (see 4.5), then:
supabase link --project-ref <your-project-ref>
supabase db push --dry-run    # prints what would be applied
supabase db push
```

Or in the SQL editor, paste one file at a time and confirm it succeeds before
moving to the next:

| Order | File | What you should see |
| --- | --- | --- |
| 1 | `0001_init.sql` | `Success. No rows returned`; 13 tables created |
| 2 | `0002_rls.sql` | RLS enabled and forced on all 13 tables |
| 3 | `0003_functions.sql` | 3 functions created |
| 4 | `0004_hardening.sql` | 1 constraint, 6 indexes, 3 functions replaced |

If a file fails, stop: the later files assume the earlier ones are complete.
Do not "fix" a failure by re-running half of it by hand.

> **Why the role matters.** `record_payment`, `bootstrap_account` and
> `create_invoice_with_items` are `SECURITY DEFINER`. They run as their owner,
> which on Supabase is `postgres` — a role with `BYPASSRLS`, so `FORCE ROW LEVEL
> SECURITY` does not block them. If you apply the migrations as some other role
> that does not own the tables and has no `BYPASSRLS`, those functions fail with
> `new row violates row-level security policy`. Re-create them as `postgres`
> (re-run `0003` and `0004` in the SQL editor) and the problem is gone.

### 4.3 Row Level Security, precisely

- **The API is the enforcement layer.** It connects with the `service_role`
  key, which has `BYPASSRLS`, and filters every query by the `organization_id`
  resolved from the verified Firebase token. RLS is the second layer.
- **`anon` and `authenticated` have no table privileges** (`revoke all` in
  `0002`) **and no policies** (default deny). Even a leaked anon key reads
  nothing. `0004` also sets default privileges, so tables added later start
  closed.
- **`FORCE ROW LEVEL SECURITY`** removes the normal "the table owner bypasses
  RLS" exemption. It is kept on all 13 tables; `postgres` and `service_role`
  still pass because they carry `BYPASSRLS`, not because they are exempt as
  owners.
- **A service key stops bypassing RLS if the request carries a user access
  token.** The API client never attaches one (`persistSession: false`), so this
  does not apply here — but never reuse this client in a browser or forward a
  user's Supabase JWT through it.
- **`invoice_items` has no `organization_id`.** It is only reachable through an
  invoice the API has already matched to the caller's organization. Any future
  policy on it must join `invoices`, not trust `invoice_id` alone.
- **Payments:** idempotency is the unique key
  `(provider, provider_payment_id)`. It is global, not per organization, so a
  provider cannot deliver the same transaction twice for two tenants.
- **Firebase → organization mapping:** `users.firebase_uid` (unique) →
  `organization_members` → `organizations`. There is no table that stores an
  organization id chosen by the client.

### 4.4 Database verification checklist

Run this in the SQL editor after the migrations. Every value must match, or
something in sections 4.2/4.3 did not apply. The syntax of these queries is
parse-checked with the harness at the end of this document; the expected values
come from reading the migrations, not from a run against a live database.

```sql
-- 1. 13 tables, all with RLS enabled AND forced
select relname, relrowsecurity as enabled, relforcerowsecurity as forced
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
-- expect: 13 rows; enabled and forced are true on every row

-- 2. no policies at all (default deny for anon/authenticated)
select schemaname, tablename, policyname from pg_policies where schemaname = 'public';
-- expect: 0 rows

-- 3. anon/authenticated cannot read any table
select c.relname,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by c.relname;
-- expect: 13 rows; every value false

-- 4. service_role can read every table
select count(*) as tables_service_role_can_read
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  and has_table_privilege('service_role', c.oid, 'select');
-- expect: 13

-- 5. functions are executable by service_role only
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('bootstrap_account', 'create_invoice_with_items', 'record_payment')
order by p.proname;
-- expect: 3 rows; security_definer true, anon_execute false,
--         authenticated_execute false, service_role_execute true

-- 6. every SECURITY DEFINER function pins its search_path
select p.proname, p.proconfig
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef
order by p.proname;
-- expect: 3 rows; proconfig contains search_path=public, pg_temp

-- 7. every foreign key is covered by an index that leads with its first column
select c.conrelid::regclass as table_name,
       c.conname,
       (select string_agg(a.attname, ', ' order by k.ord)
          from unnest(c.conkey) with ordinality as k(attnum, ord)
          join pg_attribute a
            on a.attrelid = c.conrelid and a.attnum = k.attnum) as child_columns
from pg_constraint c
where c.contype = 'f'
  and not exists (
    select 1
    from pg_index i
    where i.indrelid = c.conrelid
      and i.indisvalid
      and i.indpred is null        -- a partial index cannot serve the check
      -- indkey is an int2vector: element 0 is the index's first column
      and i.indkey[0] = c.conkey[1]
  )
order by 1, 2;
-- expect: 0 rows
```

Then a functional smoke test with the API running (section 6):

1. `GET /api/health` → `database: "ok"`.
2. Sign in once → a `users` row, one `organizations` row and one
   `organization_members` row with role `owner` exist.
3. Create a customer and an invoice → `invoices.subtotal` equals the sum of
   `invoice_items.line_total`.
4. Try to read another organization's invoice id → `404`, never its data.
5. Replay the same payment callback twice → one `payments` row and the invoice
   credited once.

### 4.5 Backup and rollback

- **Back up before migrating.** Supabase keeps daily backups on paid plans; the
  free plan does not. Take your own snapshot first:
  `pg_dump --no-owner --format=custom "$SUPABASE_DB_URL" > backup-before-migrations.dump`
  (the connection string is under *Project Settings → Database*; keep the file
  out of the repository).
- **There are no down-migrations.** Rolling back means restoring the dump, not
  running SQL backwards. Never "roll back" by dropping tables on a database
  that holds customer data.
- `0004_hardening.sql` is additive and reversible by hand if needed:
  ```sql
  alter table public.invoices drop constraint if exists invoices_customer_same_org;
  drop index if exists public.customers_organization_id_id_key;
  drop index if exists public.invoices_customer_idx;
  drop index if exists public.sales_customer_idx;
  drop index if exists public.conversations_customer_idx;
  drop index if exists public.ai_interactions_user_idx;
  drop index if exists public.payments_organization_id_idx;
  ```
  Re-creating the previous function bodies requires `0003`; restoring the dump
  is the reliable path.
- **Restore drill:** restore the dump into a *new* Supabase project and point a
  staging deployment at it. Practise this once before you need it.
- Migrations run at deploy time are forbidden by design: the API never executes
  DDL.

### 4.6 Local validation against a real PostgreSQL

`npm run test:db` starts a throwaway PostgreSQL from the `embedded-postgres`
dev dependency (temporary data directory, random loopback port, data deleted on
exit), applies `0001`–`0004` in order as the superuser, and runs 38 checks:
the seven §4.4 queries above, catalog structure (13 tables, 18 foreign keys, 17
indexes), privileges and RLS enforcement as `anon`/`authenticated`, and
functional tenant-isolation and payment-reconciliation tests on disposable
data. It reads no `DATABASE_URL` or Supabase credential and never connects to a
hosted project.

What it cannot cover: pooler behaviour, the real `service_role` JWT, Firebase
token verification, and provider webhooks end to end. Those need the deployed
project.

---

## 5. Firebase Auth

1. Firebase console → Project settings → Service accounts → *Generate new
   private key*. Store the whole JSON on one line (or its base64 encoding) in
   `FIREBASE_SERVICE_ACCOUNT`. Do not write it into the repository.
2. Enable the sign-in providers you need; keep the web config in `VITE_FIREBASE_*`.
3. The client gets an ID token with `getIdToken()` and sends it as
   `Authorization: Bearer <idToken>`; `api/_lib/auth.ts` verifies signature,
   issuer, audience and expiry with `firebase-admin/auth`
   (`verifyIdToken(token, true)`, so revoked tokens and disabled accounts are
   rejected too) and answers 401 for anything else.
4. `POST /api/auth/session` bootstraps the user's organization on first login
   and returns `{ user, organization, role }`.

Service-account parsing, key newline handling, project-id consistency and the
token-failure matrix are detailed in section 11.4; the current code accepts
plain JSON **or** its base64 encoding in the single `FIREBASE_SERVICE_ACCOUNT`
variable (there is no separate `_BASE64` variable).

If `FIREBASE_SERVICE_ACCOUNT` is absent, every protected route answers
`503 auth_not_configured`. The project id alone (`VITE_FIREBASE_PROJECT_ID`) is
not accepted: it cannot sign tokens, so treating it as configured only turned a
clear 503 into a 500.

---

## 6. Running locally

```bash
npm install
npm run dev          # frontend only, http://localhost:5173 (demo mode)
```

To exercise the functions locally, use the Vercel CLI so `/api/*` is served
with the Node runtime and your `.env`:

```bash
vercel dev           # SPA + /api/* on http://localhost:3000
```

Checks:

```bash
npm run typecheck:api   # tsc -p tsconfig.api.json (api/ only, no emit)
npm run test:api        # node --import tsx --test tests/api/*.test.ts
npm run build           # frontend production build (tsc -b && vite build)
```

`vercel.json` keeps the SPA fallback rewrite but excludes the API:
`/((?!api/).*)` → `/index.html`. A bare `/(.*)` catch-all also matches
`/api/*`, and Vercel's own knowledge-base article on 404s says that then "every
API call gets rewritten to `index.html`". Client routes still resolve to the SPA,
and `/api/*` is served by the functions. See section 11.6.

---

## 7. API reference

All responses are JSON with `cache-control: no-store` and `x-request-id`.
Errors are `{ error, code, requestId, details? }` — never a stack trace, SQL
text or provider message.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | Public. Reports configuration flags only, never values |
| POST | `/api/auth/session` | Verifies token, bootstraps org, returns context |
| GET/POST | `/api/customers` | `?limit=1..100&offset=` |
| GET/PATCH/DELETE | `/api/customers/:id` | Cross-tenant ids answer 404 |
| GET/POST | `/api/sales` | Totals computed server-side |
| GET/PATCH | `/api/sales/:id` | Status/notes only |
| GET/POST | `/api/invoices` | POST creates header + items atomically |
| GET/PATCH | `/api/invoices/:id` | `paid` is not a settable status |
| POST | `/api/ai/chat` | Chat completion |
| POST | `/api/ai/message` | Customer message drafting |
| POST | `/api/ai/insights` | Structured insights (validated output) |
| POST | `/api/ai/reminder` | Payment reminder drafting |
| POST | `/api/payments/:provider/webhook` | Click / Payme / Uzum / Stripe |

Status codes: `400` malformed, `401` missing/invalid token, `403` foreign origin
or insufficient role, `404` missing **or foreign** resource, `405` method,
`409` conflict, `413` body > 256 KB, `422` validation (field paths only),
`429` rate limited, `503` integration not configured, `500` generic.

Roles: `owner`, `admin`, `manager` may write; `viewer` is read-only.

---

## 8. Security model

- **Tenant isolation** — every query is filtered by the organization resolved
  from the verified token. A record belonging to another organization is
  reported as `404`, exactly like a missing record, so existence never leaks.
- **Validation** — Zod `strictObject` everywhere; pagination is capped at 100;
  request bodies are capped at 256 KB; unknown JSON keys are rejected.
- **CORS** — only `ALLOWED_ORIGINS` plus `localhost`/`127.0.0.1` are accepted.
  A foreign `Origin` receives `403 cors_rejected` instead of being served.
- **Rate limiting** — fixed window per key: `auth` 30/min per IP, `payments`
  120/min per IP, `data` 120/min per organization (see section 10 for limits).
- **Errors** — internal failures log structured metadata server-side and return
  `{ error: "Internal server error", code: "internal_error", requestId }`.
- **Secrets** — read only in `api/_lib/env.ts` via `process.env`. No `VITE_`
  prefix, no value ever echoed in a response or a log line.

---

## 9. Payments

| Provider | Verification |
| --- | --- |
| Click | MD5 over `click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time`, compared in constant time. Failures are reported in the body (`-1` signature, `-2` amount, `-4` already paid, `-5` invoice not found). `action=0` (prepare) only acknowledges, and only when the invoice exists |
| Payme | HTTP Basic (`Paycom:<key>`) + JSON-RPC methods `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`. `params.amount` is tiyin, so it is divided by 100 before it is stored |
| Uzum | HMAC-SHA256 of the raw body in `x-signature` (hex). **Confirm the exact signing input with your Uzum merchant contract before going live** |
| Stripe | `stripe-signature` `t=…,v1=…` HMAC-SHA256 with a 300 s tolerance. Only `checkout.session.completed`, `payment_intent.succeeded` and `payment_intent.payment_failed` are handled (a completed session must also be `payment_status: paid`), and the PaymentIntent id is the idempotency key so the checkout and intent events for one payment credit once |

Invariants: a provider is usable only when its credentials exist (otherwise
`503 payment_not_configured`); the invoice is identified by our own reference
inside the callback, and a reference that is not a uuid is answered as "not
found" instead of reaching Postgres (a malformed uuid would otherwise raise
`22P02` and turn every retry into a 500); a duplicate callback is idempotent via
the unique key in `record_payment`; a `pending` or `failed` payment may still
become `succeeded`, but a settled one never changes; and only the database
decides an invoice is `paid`. Nothing a browser reports can mark an invoice
paid. Refunds are not modelled: cancelling a succeeded payment is a state
conflict, not a reversal.

**Webhook raw body.** Signature schemes need the exact request bytes. The
webhook route sets `export const config = { api: { bodyParser: false } }` so the
body arrives unparsed. If the platform still hands over an already-parsed
object, `readRawBody` re-serialises it; that is byte-identical only for compact
JSON, so a signature check that depends on exact bytes fails closed (401/400)
rather than accepting an unverified event. If Stripe callbacks fail with
`payment_signature_invalid` in a real deployment, check this first — it is a
documented caveat, not a silent pass.

Register these callback URLs on each provider dashboard:

```
https://<your-domain>/api/payments/click/webhook
https://<your-domain>/api/payments/payme/webhook
https://<your-domain>/api/payments/uzum/webhook
https://<your-domain>/api/payments/stripe/webhook
```

---

## 10. Deployment, limits and next steps

Deploy:

1. Push the repository to Vercel; Framework preset = Vite, build `npm run build`,
   output `dist`. `api/` is detected automatically (Node runtime, ESM).
2. Add every server-only variable from section 3 in **Vercel → Settings →
   Environment Variables** (Production and Preview separately). Never commit
   them and never prefix them with `VITE_`.
3. Apply migrations (section 4) before the first real request.
4. Set `VITE_USE_DEMO_MODE=false` for the production build after the values in
   step 2 exist.
5. Verify: `GET https://<your-domain>/api/health` should report
   `database: "ok"`, `auth: "configured"` and the provider flags you configured.

Self-check before shipping (already run in this repository):

```bash
npm run typecheck:api                     # passes
npm run test:api                          # 68 tests pass
npm run test:db                           # real PostgreSQL 18: 38 checks pass
# SQL grammar check, no database needed (libpg_query via pglast):
#   python -m venv .freebuff/sqlcheck && .freebuff/sqlcheck/Scripts/python -m pip install pglast
#   .freebuff/sqlcheck/Scripts/python .freebuff/sqlcheck/validate.py       # migrations
#   .freebuff/sqlcheck/Scripts/python .freebuff/sqlcheck/validate_docs.py  # SQL in this file (§4.4, §4.5)
npm run build                             # passes
grep -rIl -E "SUPABASE_SERVICE_ROLE_KEY|FIREBASE_SERVICE_ACCOUNT|AI_API_KEY|STRIPE_SECRET_KEY|CLICK_SECRET_KEY|PAYME_KEY|UZUM_SECRET_KEY|service_role" dist
# no matches, plus no "BEGIN PRIVATE KEY" in dist/
```

Known limitations — read before scaling:

- **Rate limiting is in-memory per instance.** It is a real limit per serverless
  instance, not a global one. For hard global limits, move the counters to
  Upstash Redis / Supabase and keep the same `RATE_LIMITS` interface.
- **AI quota** is enforced per organization per UTC day (`AI_DAILY_LIMIT_PER_ORG`)
  plus 20 requests/minute; usage is recorded in `ai_interactions`. No AI call is
  made unless `AI_API_KEY` (or `OMNIROUTE_API_KEY`) is set.
- **Not executed in this environment:** migrations, Firebase token
  verification, Supabase queries and paid AI calls require a real Supabase
  project, a Firebase service account and provider credentials, none of which
  exist here. Those paths are type-checked and unit-tested at the validation /
  signature / pipeline level, but not integration-tested against live services.
- **Frontend is not wired to the API.** `src/lib/api-client.ts` exists and
  `src/services/ai/edge-provider.ts` points at `/api/ai/chat`, but no screen was
  rewired, per the "do not modify the UI" constraint. Wiring a screen is a
  follow-up, not a fix.
- The frontend bundle is >500 KB (Vite warning); pre-existing, unrelated to the
  backend.

Next steps, in order:

1. Create the Supabase project, run the three migrations, set
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
2. Create the Firebase service account and set `FIREBASE_SERVICE_ACCOUNT`.
3. Deploy to Vercel, check `/api/health`, then log in once to trigger
   `bootstrap_account`.
4. Configure one payment provider end-to-end (Click is the simplest) and test a
   real callback.
5. Wire screens to `src/lib/api-client.ts` one at a time.

---

## 11. Supabase Cloud and Firebase: connecting a real development project

Section 4 creates the schema by hand and section 4.6 validates it locally. This
section covers the part that cannot live in a repository: creating a
**development** Supabase project, wiring Firebase Admin, and reading
`/api/health` until it is green.

Nothing in this section was executed against a live project while it was
written. No remote database or Firebase project was contacted, and no
credentials were requested.

### 11.1 Create a separate development Supabase project

1. <https://supabase.com/dashboard> → **New project**. Choose the region closest
   to your users, let Supabase generate the database password, and store it in a
   password manager. The API never uses it (supabase-js speaks PostgREST over
   HTTPS); it is needed only for `psql` in section 11.2.
2. Use a dedicated project (for example `savdopilot-dev`) in its own Supabase
   organization when a production project exists. Development must not be able
   to reach production, and section 11.2 runs real statements.
3. **Project Settings → API**:

   | Value on that page | Goes into |
   | --- | --- |
   | `Project URL` | `SUPABASE_URL` (server) and `VITE_SUPABASE_URL` (browser) |
   | `anon` / publishable key | `VITE_SUPABASE_ANON_KEY` (browser only; every table denies `anon`, so it reads nothing — that is intended) |
   | `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (server only; bypasses RLS) |

   Copy the project URL exactly; `/rest/v1` and a trailing slash are both
   normalised away by `api/_lib/env.ts`, and a non-loopback `http://` URL is
   rejected because the service role key must never cross plaintext.

4. **Project Settings → Database → Connection string** is needed only for
   `psql`/a SQL GUI in section 11.2, with `sslmode=require` (Supabase closes
   plaintext connections). The API has no `DATABASE_URL`: it never opens a
   Postgres connection itself.

### 11.2 Migration compatibility and order

- `0001`–`0004` are plain SQL and use only features Supabase provides
  (`pgcrypto`, `gen_random_uuid`, `plpgsql`, `security definer`).
- Apply them in numeric order, each in its own transaction, as the project owner
  (`postgres`, which is what the SQL editor and `supabase db push` use). The
  `security definer` functions depend on that ownership (§4.3).
- `0002`/`0003` reference Supabase's built-in `anon`, `authenticated` and
  `service_role` roles. They exist on Supabase; on a bare PostgreSQL server they
  must be created first (`tests/db/run.mjs` shows the minimal emulation).
- Run the seven queries of §4.4 afterwards. Phase 4 executed `0001`–`0004` and
  those queries against a real PostgreSQL 18 and all 38 checks passed, but that
  was the embedded local server, **not** Supabase Cloud.
- Do not run `supabase db reset` (or any drop) against a project that holds data
  you care about; §4.5 is the backup/rollback procedure.

### 11.3 Verify configuration from outside

```bash
curl -s https://<dev-domain>/api/health | jq .checks
```

| `checks.database` | Meaning |
| --- | --- |
| `ok` | URL is https, the service role key works, `organizations` is readable |
| `not_configured` | `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing or a template placeholder |
| `invalid_url` | Malformed, credentialed, or plaintext `http://` to a remote host |
| `unreachable` | URL/key rejected by Supabase, project paused, or network blocked |

| `checks.auth` | Meaning |
| --- | --- |
| `configured` | `FIREBASE_SERVICE_ACCOUNT` parses and the project ids agree |
| `not_configured` | Variable missing |
| `invalid` | Unparseable JSON, missing field, non-PEM key, or an `authorized_user` credential |
| `misconfigured` | Service account `project_id` ≠ `FIREBASE_PROJECT_ID` / `VITE_FIREBASE_PROJECT_ID` |

Tenant isolation is verified at the SQL level by §4.4 (queries 6 and 7 must
return the stated rows, including the zero-row case) and at the API level by
`tests/api/auth-flow.test.ts` (§11.5).

### 11.4 Firebase Admin: what the code guarantees

1. Firebase console → **Project settings → Service accounts → Generate new
   private key**. The downloaded JSON can mint a token for any user: treat it as
   a password, never commit it, never paste it into a chat or an issue.
2. Put the whole JSON on one line in `FIREBASE_SERVICE_ACCOUNT`, or its base64:

   ```bash
   node -e "process.stdout.write(Buffer.from(require('fs').readFileSync('service-account.json')).toString('base64'))"
   ```

3. Set `FIREBASE_PROJECT_ID` to the same `project_id` (optional; it falls back to
   `VITE_FIREBASE_PROJECT_ID`). Verification uses the service account's project,
   so a stale public value cannot break login — it is reported instead of
   silently producing 401s.
4. `api/_lib/auth.ts` toggles the following behaviour:

   | Case | Behaviour |
   | --- | --- |
   | Plain JSON or base64 | Both accepted; parse errors name the field only |
   | Private key with literal `\n` or CRLF | Normalised to a real multi-line PEM |
   | Value that is not a PEM key | Rejected with a field-specific error → `503`, not an obscure SDK crash |
   | `authorized_user` (ADC) credential | Rejected with its `type` in the message |
   | App initialisation | Explicit `projectId` from the service account, so the token audience is deterministic |
   | Expired token | `401 unauthorized`, `details.reason: "auth/id-token-expired"` |
   | Wrong signature / wrong project / malformed token | `401 unauthorized`, `details.reason: "auth/argument-error"` (Firebase's code) |
   | Revoked token / disabled account | `401` — `verifyIdToken(token, true)` performs the revocation check |
   | No credentials | `503 auth_not_configured`, fail closed |
   | Rotating the key | Generate a new key, update the variable, redeploy, then delete the old key in the console |

### 11.5 What the tests actually cover

`npm run test:api` runs 68 tests; the 34 added here are:

| File | Tests | Covers |
| --- | --- | --- |
| `tests/api/env.test.ts` | 12 | https/loopback rules, URL normalisation, placeholder rejection, service-role requirement, project-id precedence, CORS, AI and payment gating |
| `tests/api/firebase-config.test.ts` | 9 | JSON and base64 parsing, `\n`/CRLF normalisation, non-PEM and `authorized_user` rejection, field-specific errors (never the key), `missing`/`invalid`/`project_mismatch`/`ok` status |
| `tests/api/auth-flow.test.ts` | 13 | Real handlers through the real pipeline, with a fake PostgREST and an injected verifier: missing token, malformed header, expired token, invalid signature, missing service account, valid member, foreign organization `404`, query filtered by the token's organization (never the caller's), cross-tenant write rejected before the database, unreachable database `500`, unconfigured database `503` |

`tests/api/auth-flow.test.ts` substitutes exactly two things — Firebase's
signature check (`__setVerifierForTests`, which throws unless
`NODE_ENV=test`, an environment Vercel never sets) and PostgREST. Everything
between them is the production code path.

**Still not proven by these tests:** token cryptography against Google's public
keys, a real `checkRevoked` round-trip, PostgREST/Postgres behaviour, RLS under a
real JWT, Vercel's routing and rewrites. Each needs a live project.

### 11.6 Vercel readiness

- **Fixed:** `vercel.json` had a catch-all `/(.*)` → `/index.html` rewrite, which
  also matches `/api/*`. Vercel's knowledge base ("Why is my deployed project
  giving 404") states that then "every API call gets rewritten to `index.html`".
  It is now `/((?!api/).*)`, so client routes still fall back to the SPA and
  `/api/*` reaches the functions.
- Framework preset **Vite**, build `npm run build`, output `dist`. `api/**` is
  detected as Node ESM functions; no `functions` block is required.
- If an AI or webhook route exceeds the default function duration on your plan,
  raise `maxDuration` for `api/**` in `vercel.json`. Not changed here, because
  the allowed limit depends on the Vercel plan.
- Set every server-only variable from §3 in **both** Production and Preview, then
  redeploy (environment changes do not affect an existing deployment).
- `ALLOWED_ORIGINS` must contain the deployed origin (for example
  `https://savdopilot.vercel.app`); localhost is always allowed.
- `/api/health` is public by design and returns only configuration states.
- No deployment was performed.

### 11.7 Manual steps still required

| # | Step | Where | Verify with |
| --- | --- | --- | --- |
| 1 | Create the development Supabase project | Supabase dashboard | `SUPABASE_URL` ends in `.supabase.co` |
| 2 | Apply `0001`–`0004` in order | SQL editor / `supabase db push` | §4.4 queries |
| 3 | Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel + local `.env` | `/api/health` → `database: "ok"` |
| 4 | Generate the Firebase service account, set `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID` | Vercel + local `.env` | `/api/health` → `auth: "configured"` |
| 5 | Add the deployed origin to `ALLOWED_ORIGINS` | Vercel | login from that origin, not 403 |
| 6 | Sign in once as a real user | App | `POST /api/auth/session` returns an organization; `bootstrap_account` ran |
| 7 | Configure one payment provider (§9) | Provider dashboard + Vercel | a real callback moves an invoice to `paid` |
