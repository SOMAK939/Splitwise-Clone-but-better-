# SplitFree

Split bills with friends. Free forever, with a little roast.

SplitFree is a free alternative to Splitwise: unlimited expenses, no ads, UPI settle-up links, and (coming soon) fun group insights like **Chindi of the Month** and **Slow Settler 🐢**.

It's built with [Expo](https://expo.dev) (React Native) and [Supabase](https://supabase.com), and ships first as an installable web app (PWA): friends open a link and tap **Add to Home Screen**.

## What works today

- Sign up / sign in with Google or with email and password
- Monthly badges (Chindi of the Month, Slow Settler...), recap and nudges
- About, Privacy and Terms pages
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
2. Open **SQL Editor** and run each file in `supabase/migrations/` once, oldest first (paste it in, click **Run**).
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

> Add the Vercel variables as type **Config**, not **Secret**: Vercel refuses `EXPO_PUBLIC_` secrets, and the values must be exactly the Project URL (`https://<id>.supabase.co`) and publishable key.

### 4. Turn on "Continue with Google" (optional, about 10 minutes)

1. Run `supabase/migrations/20261102120000_google_names.sql` in the Supabase **SQL Editor**, so Google users get their real name.
2. Go to [Google Cloud Console](https://console.cloud.google.com), create a project called **SplitFree**.
3. **APIs & Services → OAuth consent screen** (or **Google Auth Platform → Branding**): choose **External**, app name **SplitFree**, your support email, logo `assets/images/icon.png`, and these links:
   - Home page: `https://<your-site>.vercel.app/about`
   - Privacy policy: `https://<your-site>.vercel.app/privacy`
   - Terms of service: `https://<your-site>.vercel.app/terms`
4. Under **Audience**, click **Publish app** so anyone can sign in (name and email are basic scopes, so no review is needed).
5. **Clients → Create client → Web application**:
   - Authorized JavaScript origins: `https://<your-site>.vercel.app`
   - Authorized redirect URIs: `https://<your-project-id>.supabase.co/auth/v1/callback`
6. Copy the **Client ID** and **Client secret** into Supabase: **Authentication → Sign In / Providers → Google**, turn it on, paste both, **Save**.
7. In Supabase **Authentication → URL Configuration**, make sure **Redirect URLs** includes `https://<your-site>.vercel.app/**`.

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
