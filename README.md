# Fan Card Platform

A multi-celebrity fan card platform built with Next.js 16, Prisma, and Tailwind CSS.
Supports fan cards, celebrities, events, ticketing, payments (bank transfer + Flutterwave),
and a real-time fan→celebrity chat system (text, image, voice, call).

## Stack
- **Framework:** Next.js 16 (App Router, React 19)
- **Database:** PostgreSQL via Prisma (Supabase Postgres recommended for production)
- **Payments:** Flutterwave (card, in USD) + admin-managed bank-transfer verification
- **Chat:** Server-side chat APIs + realtime layer (SSE dev shim; Cloudflare WebSockets/Durable Objects in prod)
- **Events:** Ticketmaster & Eventbrite API ingestion
- **Emails:** Resend (transactional)
- **Storage:** Supabase Storage (chat attachments, service-role key, server-side only)

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
| `FLUTTERWAVE_SECRET_KEY` + `PAYMENT_PROVIDER="flutterwave"` | Card payments (USD) | `.env` or Admin → Payment settings |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Admin auth sessions + chat attachments | `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | Severside chat attachment upload (never leaks to the browser) | `.env` |
| `EVENT_TICKETING_API_KEY` | Ticketmaster events & ticket inventory | `.env` or Admin → Event settings |
| `EVENTBRITE_TOKEN` | Eventbrite events | `.env` or Admin → Event settings |
| `RESEND_API_KEY` | Transactional emails | `.env` or Admin → Notifications |
| `COOKIE_SECRET` | Session signing (required, long random string) | `.env` |
| `ADMIN_PASSWORD` | Admin login password | `.env` |
| `MIGRATION_DATABASE_URL` | Prisma CLI only (session pooler, 5432) | `.env` |

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

---

## Chat & messaging (fan ↔ celebrity)

WhatsApp-style private chat between fans and their chosen communities.

**Gating:** any **active fan card** unlocks text + image chat with that community.
Premium features (voice notes, voice calls, video calls) unlock per-celebrity on any
**paid** fan card (`membershipLevel.price > 0`). All prices are USD.

**Models** (`prisma/schema.prisma`, migration `20260910160000_chat_messaging`):
`ChatConversation` (one per fan×celebrity), `ChatMessage` (idempotent via
`[conversationId, clientId]`, soft-delete, reply threading, `attachmentJson`),
`ChatReadState` (watermark read receipts), `ChatBlock`, `MessageReport`, and
`FanCelebritySelection` (the "Choose Your Celebrities" onboarding step).

**Server libs** (`src/lib/chat/`): `access.ts` (card/block/team gates),
`messages.ts` (send with optimistic retry, cursor pagination, edit/delete window),
`presence.ts` (online/offline), `list.ts` / `admin-list.ts` (fan + team inbox views).

**Realtime:** the client hook (`src/hooks/useChatRealtime.ts`) opens Server-Sent
Events at `/api/chat/events` (a 2s polling shim for dev/Vercel). In production the
same fire-and-forget interface should be backed by Cloudflare WebSockets + Durable
Objects so conversation rooms scale to millions of concurrent fans.

**Endpoints:** `/api/chat/*` — conversations, room metadata (incl. premium unlock),
messages (GET cursor / POST idempotent send), read receipts, mute, typing,
attachments (Supabase Storage, 25 MB allowlisted uploads), message edit/delete,
block/unblock, report, unread-badge count, and `/api/chat/admin/*` team inbox.

**UI:** `/chat` (fan conversation list with unread badges), `/chat/[id]` (full room:
bubbles, status ticks, replies, lightbox, call overlay, premium gate, inline
composer), `/admin/messages` (team inbox), and a "Chat Now" CTA on celebrity
profiles. The header shows a live Messages link with an unread badge.

**Email notifications:** the first message of each conversation emails the offline
recipient (fan by default; the first admin for the team inbox). `EmailMessage.dedupeKey`
guarantees one notification per conversation — no spam. Works with the existing
Resend queue and cron.

> **Runtime env note:** chat attachment uploads require `SUPABASE_SERVICE_ROLE_KEY`
> to be set on the server. Without it the upload endpoint returns an error but the
> rest of the chat works normally.

---

## Deployment

**Dev/preview — Vercel:** every page plus the `/api/*` route handlers deploy as
serverless functions. Realtime chat uses the `/api/chat/events` SSE polling shim,
which works fine on serverless. Set the same env vars as `.env` (two URLs for
Prisma, Supabase keys, Flutterwave, Resend, `COOKIE_SECRET`, `ADMIN_PASSWORD`).

**Production — Cloudflare (recommended):** the app is architecturally Cloudflare-ported
— no Vercel-only capability is used by the production design.
1. **Database & storage** stay managed: Supabase Postgres (via
   `MIGRATION_DATABASE_URL` for migrations, transaction pooler for the app) and
   Supabase Storage for chat attachments.
2. **Realtime chat:** replace the SSE dev shim with a Cloudflare Worker hosting a
   WebSocket + Durable Object per conversation room (`src/lib/chat/realtime.ts`
   already defines the event/serialization contract). Clients connect with the same
   fan/admin auth cookies; presence, typing, read receipts and new messages publish
   through the room object in near-real time.
3. **Email queue:** the existing cron endpoint
   (`/api/cron/email-queue`, admin-auth protected) runs as a Cloudflare scheduled
   Worker binding.
4. **Static output:** pages using server rendering (`revalidate`) map to Cloudflare
   Workers/static assets via the adapter of choice (`@cloudflare/next-on-pages`).

> Chat messages strongly prefer the transactional pooler port (6543) at runtime;
> only Prisma CLI commands (migrations) use the session pooler (5432).
