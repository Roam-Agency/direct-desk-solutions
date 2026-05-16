# Direct Desk Solutions

Production e-commerce site and admin CRM for Direct Desk Solutions, a UK office furniture retailer (new + second-hand).

**Status:** in build. Production app scaffolding to follow.

## Repository structure

- `/` — production Next.js app (in progress)
- `/mockup` — original clickable design prototype (React + Tailwind via CDN, no build step)

## Mockup live demo

[https://roam-agency.github.io/direct-desk-solutions/](https://roam-agency.github.io/direct-desk-solutions/)

Auto-deploys from `mockup/` via `.github/workflows/pages.yml` on every push to `main`.

To preview the mockup locally, open `mockup/index.html` directly in a browser.

## Production stack (in build)

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres database + auth)
- Cloudinary (image storage and CDN)
- Stripe (payments)
- Resend (transactional email)
- Netlify (hosting)
