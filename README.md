# Direct Desk Solutions

E-commerce site and admin CRM for Direct Desk Solutions, a UK office furniture retailer (new + second-hand).

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Database:** Supabase (Postgres) — coming soon
- **Image storage:** Cloudinary — coming soon
- **Payments:** Stripe — coming soon
- **Email:** Resend — coming soon
- **Hosting:** Netlify — coming soon
- **Runtime:** Node 22 LTS

## Local development

See `.env.example` for required environment variables. Copy it to `.env.local` and fill in real values before running `npm run dev`.

## Repo structure

- `src/app/` — pages (App Router)
- `src/app/(shop)/` — customer-facing routes
- `src/app/admin/` — admin CRM, auth-gated
- `src/app/api/` — server endpoints
- `src/components/` — React components
- `src/lib/` — service clients (Supabase, Stripe, Cloudinary)
- `public/` — static assets

## Status

In active build. See git log for progress.
