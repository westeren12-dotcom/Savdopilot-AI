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
supabase/migrations/            0001_init.sql, 0002_rls.sql, 0003_functions.sql
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
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed by CORS |
| `APP_URL` | Fallback origin when `ALLOWED_ORIGINS` is empty |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL` | AI provider |
| `OMNIROUTE_API_KEY`, `OMNIROUTE_API_BASE_URL` | Used when `AI_PROVIDER=omniroute` |
| `AI_DAILY_LIMIT_PER_ORG` | Hard daily cap per organization (default 200) |
| `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`, `PAYME_KEY`, `UZUM_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Provider credentials, one set per enabled provider (empty = "not connected"). Merchant ids are not read because the webhook identifies the invoice from the callback itself |

Any value that still looks like the template placeholder (`your-…`, `CHANGEME`)
or an empty string is read as *not configured*, so a half-filled `.env` can
never silently enable something.

Vite only bundles files reachable from `src/main.tsx`; `api/_lib/env.ts` reads
`process.env` and is not imported from `src/`, so no server value can reach the
bundle. This is verified with a grep of `dist/` (section 9).

---

## 4. Database migrations

Three ordered SQL files in `supabase/migrations/`. Apply them in order:

```bash
# Option A — Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# Option B — SQL editor: paste 0001, then 0002, then 0003
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

---

## 5. Firebase Auth

1. Firebase console → Project settings → Service accounts → *Generate new
   private key*. Store the JSON as `FIREBASE_SERVICE_ACCOUNT` (one line) or
   `FIREBASE_SERVICE_ACCOUNT_BASE64`. Do not write it into the repository.
2. Enable the sign-in providers you need; keep the web config in `VITE_FIREBASE_*`.
3. The client gets an ID token with `getIdToken()` and sends it as
   `Authorization: Bearer <idToken>`; `api/_lib/auth.ts` verifies it with
   `firebase-admin/auth` (`verifyIdToken`, revocation checks disabled for
   latency) and rejects anything else with 401.
4. `POST /api/auth/session` bootstraps the user's organization on first login
   and returns `{ user, organization, role }`.

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

`vercel.json` keeps the SPA fallback rewrite (`/(.*)` → `/index.html`). Vercel
matches filesystem functions before rewrites, so `/api/*` is served by the
functions and every other path by the SPA. No change was needed there.

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
npm run test:api                          # 34 tests pass
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
