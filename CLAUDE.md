# bnb2aade — Short-Term Rental AADE Filing SaaS

## What This Is
A SaaS platform with an AI browser agent that automatically files short-term rental 
declarations (Airbnb/Booking.com) with the Greek tax authority (AADE).
Target customers: Airbnb property managers and individuals.

## Stack (confirm before implementing)
- Frontend: Next.js + Tailwind CSS (Greek + English i18n, light/dark mode)
- Backend: TypeScript (Node.js)
- Database: Local PostgreSQL via Docker → Supabase later
- Agent: Playwright browser automation
- AI: Claude API (claude-sonnet-4-20250514)
- Queue: BullMQ or node-cron for daily jobs
- Auth: NextAuth.js

## Key Commands
- `docker compose up` — start local Postgres
- `npm run dev` — start dev server
- `npm run test` — run tests

## Repo
git@github.com:ekartsonakis/bnb2aade.git

## Business Rules
- 1 filing = 1 credit = €1
- Only file bookings where checkout has already occurred
- Agent runs once per day (pull new bookings + file with AADE)
- Premium plan: €10/month (multiple Airbnb/Booking ↔ AADE account mappings)
- Test account: pre-seeded with 200 credits
- Users can Pause/Resume the service at any time
- Daily report: filing summary + per-AADE-account screenshots as proof

## Code Style
- TypeScript strict mode
- Each integration (Airbnb, Booking, AADE, notifications) as a separate service/module
- async/await only
- All secrets in .env (never committed), with .env.example committed

## Build Order
1. Docker Compose + Postgres schema
2. Auth + portal skeleton (register, login, dashboard)
3. AADE browser agent (mock environment first)
4. Airbnb + Booking.com ingestion (iCal feeds preferred)
5. Credit system + daily job scheduler
6. Notifications (SMS/WhatsApp/Viber/Email via Twilio or similar)
7. i18n, dark mode, daily PDF reports with screenshots
8. Stripe integration + premium plan

## Always
- Commit frequently to the repo
- Ask clarifying questions before starting each major phase
- Use Docker for all local services
