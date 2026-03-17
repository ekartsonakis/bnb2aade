# Project: bnb2aade — Short-Term Rental Tax Filing SaaS

## Overview
Build a production-ready SaaS platform with an AI browser agent that automatically files short-term rental declarations (Airbnb/Booking.com stays) with the Greek tax authority (AADE) on behalf of property managers and individuals. The project lives in the already-cloned repo at git@github.com:ekartsonakis/bnb2aade.git — commit all code there.

---

## Core Agent Behavior
- The AI agent uses browser automation (Playwright or Puppeteer) to log into AADE's portal and file short-term rental (βραχυχρόνια μίσθωση) declarations.
- Only process bookings where checkout has already occurred.
- The agent runs once per day, pulling new completed bookings from Airbnb and Booking.com via their APIs or scraping (discuss best approach).
- After each run, generate a daily report (PDF or HTML) with:
  - Summary of filings made
  - Per-AADE-account screenshots as proof of submission
  - Any errors or skipped bookings with reasons

---

## Web Portal — Customer-Facing
- **Auth:** Email/password registration + login (JWT or session-based)
- **Billing / Credits:**
  - 1 credit = 1 filing = €1
  - Users buy credits via the portal (Stripe integration, add later)
  - Each successful AADE filing deducts 1 credit from the account
  - **Premium plan:** €10/month — allows mapping multiple Airbnb/Booking accounts to separate AADE credentials
- **Test account:** Pre-seeded with 200 credits for internal testing
- **Service control:** Users can Pause / Resume the agent for their account at any time
- **Notifications:** Users can opt in to receive filing summaries via SMS / WhatsApp / Viber / Email, queried in natural language (e.g. "show me filings from the last 7 days"). Integrate with a messaging provider (Twilio or similar — discuss).
- **i18n:** Full Greek 🇬🇷 and English 🇬🇧 support (use i18next or similar)
- **Theme:** Light and Dark mode (Tailwind or CSS variables)

---

## Integrations
- **Airbnb:** Pull new completed reservations once per day (API or scraping — evaluate options)
- **Booking.com:** Same as above
- **AADE:** Browser automation to file declarations (Playwright recommended)
- **Notifications:** SMS/WhatsApp/Viber/Email (Twilio, MessageBird, or Vonage — pick most cost-effective)

---

## Tech Stack (discuss and confirm before implementing)
- **Backend:** Node.js (TypeScript) or Python — your recommendation
- **Frontend:** Next.js (React) with Tailwind CSS
- **Database:** Start with local PostgreSQL; plan migration path to Supabase
- **Agent runtime:** Playwright for browser automation
- **AI layer:** Claude API (claude-sonnet-4-20250514) for natural language queries and agent decision-making
- **Queue/Scheduler:** BullMQ or node-cron for daily jobs
- **Auth:** NextAuth.js or Lucia

---

## Development Approach
1. Stand everything up locally on localhost first — no cloud infra yet.
2. Use Docker Compose for local Postgres + app.
3. Commit all code to the existing repo: git@github.com:ekartsonakis/bnb2aade.git
4. Use `.env.example` for all secrets and config.
5. Write modular code — each integration (Airbnb, Booking, AADE, notifications) as a separate service/module.

---

## First Steps — Guide me through this order:
1. Scaffold the project structure and confirm tech stack choices
2. Set up Docker Compose with Postgres
3. Define the database schema (users, accounts, bookings, filings, credits, reports)
4. Build the auth + portal skeleton (registration, login, dashboard)
5. Build the AADE browser agent (start with a test/mock AADE environment)
6. Add Airbnb + Booking.com booking ingestion
7. Wire up the credit system and daily job scheduler
8. Add notifications and natural language query interface
9. Add i18n, dark mode, daily reports with screenshots
10. Prep for Stripe integration and premium plan

Ask me clarifying questions before starting each major phase if needed.
