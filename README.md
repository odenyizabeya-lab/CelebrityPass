# Fan Card Platform

A multi-celebrity fan card platform built with Next.js 16, Prisma, and Tailwind CSS.
Supports fan cards, celebrities, events, ticketing, and payments (bank transfer + Stripe).

## Stack
- **Framework:** Next.js 16 (App Router, React 19)
- **Database:** PostgreSQL via Prisma (Supabase Postgres recommended for production)
- **Payments:** Stripe (card) + admin-managed bank-transfer verification
- **Events:** Ticketmaster & Eventbrite API ingestion
- **Emails:** Resend (transactional)

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
Copy `.env.example` to `.env` and fill in the values. At minimum you need a working
`DATABASE_URL` pointing at a PostgreSQL server.

### 3. Set up the database

This project uses **PostgreSQL** (Prisma provider is `postgresql`). Choose one:

**Option A — Supabase Postgres (recommended for production)**
1. Create a free project at https://supabase.com
2. Go to **Project → Connect → Pooler**
3. Set **two** URLs in `.env` (URL-encode special chars in the password, e.g. `@` → `%40`):
   - `DATABASE_URL` → **Transaction pooler (port 6543)** — used by the running app:
     `postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`
   - `MIGRATION_DATABASE_URL` → **Session pooler (port 5432)** — used ONLY by Prisma CLI commands:
     `postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1`

4. Replace the placeholders with your real values.

> **Important — session vs transaction pooler.** The schema wires migrations through
> `directUrl = env("MIGRATION_DATABASE_URL")`. Prisma CLI commands (`migrate deploy`,
> `db pull`, `db push`, `migrate resolve`) use the **session pooler (5432)** because they
> rely on Postgres advisory locks that only work over session mode. The running app uses
> **`DATABASE_URL` (transaction pooler, 6543)** for serverless-friendly concurrency. You
> do not need to switch ports — Prisma picks the right URL automatically.

**Option B — local PostgreSQL**
```bash
# make sure local Postgres is running, then:
npm run db:migrate   # create tables via migrations
npm run db:seed      # seed celebrity communities
```

### 4. Create the schema (Supabase)
With your real `DATABASE_URL` set, run:
```bash
npm run db:deploy    # apply committed migrations to the remote DB
npm run db:seed      # seed celebrity communities (optional)
```

### 5. Run the app
```bash
npm run dev
# open http://localhost:3000
```

---

## Payment / external-service keys

| Service | Purpose | Where to set |
|---------|---------|--------------|
| `STRIPE_SECRET_KEY` + `PAYMENT_PROVIDER="stripe"` | Real card payments | `.env` |
| `EVENT_TICKETING_API_KEY` | Ticketmaster events & ticket inventory | `.env` or Admin → Event settings |
| `EVENTBRITE_TOKEN` | Eventbrite events | `.env` or Admin → Event settings |
| `RESEND_API_KEY` | Transactional emails | `.env` or Admin → Notifications |
| `COOKIE_SECRET` | Session signing (required, long random string) | `.env` |
| `ADMIN_PASSWORD` | Admin login password | `.env` |

---

## Database scripts
```bash
npm run db:generate   # regenerate the Prisma client
npm run db:migrate    # create a new migration / apply (dev)
npm run db:deploy     # apply committed migrations (prod/supabase)
npm run db:push       # push schema without migrations (quick dev)
npm run db:seed       # seed celebrity communities
```

---

## Project layout
- `src/app/` — routes and pages (public site + `/admin` console + API routes under `src/app/api/`)
- `src/components/` — React components (admin, events, payments, tickets, legal)
- `src/lib/` — business logic (auth, cards, payments, events, ticketing, email)
- `prisma/` — schema + migrations + seed scripts
- `scripts/` — CLI tools (event/ticket sync, icons)

## Licensing / notes
- Inventory and event data are only ever written by authorized source syncs — the app
  never fabricates availability, prices, or confirmations.
- Payments are never marked successful without a real charge via an authorized gateway,
  or an admin-verified bank transfer.
