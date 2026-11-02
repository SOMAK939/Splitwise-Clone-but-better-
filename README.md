# SplitFree

Split bills with friends. Free forever, with a little roast.

SplitFree is a free alternative to Splitwise: unlimited expenses, no ads, UPI settle-up links, and (coming soon) fun group insights like **Chindi of the Month** and **Slow Settler 🐢**.

It's built with [Expo](https://expo.dev) (React Native) and [Supabase](https://supabase.com), and ships first as an installable web app (PWA): friends open a link and tap **Add to Home Screen**.

## What works today

- Sign up / sign in with email and password
- Create groups and invite friends with a link or code
- Add expenses, split equally or by exact amounts, with categories
- Live balances, plus "fastest way to settle up" (debt simplification)
- Settle up with a one-tap UPI payment link, or record cash payments
- Delete an expense (long-press it)

## Project layout

```
src/
  app/                 every file here is a screen (Expo Router)
    _layout.tsx        login wall + navigation stack
    login.tsx          sign in / sign up
    index.tsx          home: your groups and overall balance
    group/[id]/        one group: balances, add expense, settle up
  components/ui.tsx    shared buttons, inputs, cards
  lib/
    balances.ts        all the money math (pure functions, fully tested)
    api.ts             every database read/write in one place
    supabase.ts        connection to Supabase
supabase/migrations/   database tables and security rules (SQL)
public/                PWA manifest, icons and HTML template
```

## Setting it up (one time, about 15 minutes)

### 1. Create a free Supabase project

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick the region closest to you (Mumbai for India).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261102000000_init.sql`, and click **Run**.
3. Go to **Project Settings → API Keys** (or **API**) and copy the **Project URL** and the **publishable** (or "anon public") key.
4. Optional while testing: **Authentication → Sign In / Providers → Email**, turn off **Confirm email** so you can sign up without checking your inbox.

### 2. Run the app on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env      # then paste your Supabase URL and key into .env
npm run web               # opens the app in your browser
```

To try it on your phone, run `npm start` and scan the QR code with the **Expo Go** app.

### 3. Put it online for free (Vercel)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account and **Import** this repository.
2. Under **Environment Variables**, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`.
3. Click **Deploy**. `vercel.json` already tells Vercel how to build the app.
4. Back in Supabase, **Authentication → URL Configuration**, set **Site URL** to your Vercel address so email links open the app.

Every push to `main` now redeploys automatically. Share the link, and friends can tap **Add to Home Screen**.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run web` | Run the app in your browser |
| `npm start` | Run the app for Expo Go on your phone |
| `npm test` | Run the money-math tests |
| `npm run typecheck` | Check the TypeScript for mistakes |
| `npm run build:web` | Build the website into `dist/` |

## Money is stored in paise

All amounts are whole paise (₹1 = 100 paise), never decimals, so totals are always exact. `src/lib/balances.ts` explains why.
