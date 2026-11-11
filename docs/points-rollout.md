# Points for ACJ Gaming and CueX Billiards — rollout runbook

Written 2026-11-07, updated 2026-11-10 for revision 2 (points admin inside each
business's own admin app; a customer points page per venue). This file is the
part someone needs on the day.

Follow the steps **in order**. Database files are run by hand in the Supabase
SQL Editor of the futsal project (`mmyjtvlnuizpwktpkuij`). Every file is safe
to re-run.

## 0. What is where

| Repo | Branch | Contains |
|---|---|---|
| Hub `PointSystem_AkoATP` | `feat/multi-business-points` | wallets per business, futsal scoping, session-points engine, `loyalty-zone-admin-migration.sql` (admin + customer functions for game/billiards), customer portals `/games/account` and `/billiards/account`, sign-up links, futsal admin APIs need a futsal grant, superadmin = global only (`retire-per-app-superadmin-migration.sql`) |
| Game `MyaThida_Game` | `feat/points` | game-points SQL, customer on sessions, record-session busy-TV fix, points rule card, **Points** section (`/admin/game/points`: requests, rewards, customers) |
| Billiards `Billiards_MyaThida` | `feat/points` | billiards-points SQL, customer card, record phone, points rule card (ships OFF), **Points** section (`/admin/billiards/points`) |

All three branches have open PRs; revision 2 commits are on the same branches.
The hub has **no** game/billiards admin pages any more (`/admin/loyalty/*` and
the `/account?biz=` switcher were removed); futsal `/account` is futsal-only.

Already live in the database (run 2026-11-07, all checks passed):
`handle-new-user-fallback-restore.sql`, `multi-business-points-migration.sql`.

## 1. Database (SQL Editor), in this order

| # | File (repo) | What it does | Check after |
|---|---|---|---|
| 1 | `session-points-migration.sql` (hub) | points rules (game 10/60 on, billiards off), phone lookup, award/reversal engine, audit fix | `select * from point_rules;` → 2 rows |
| 2 | `supabase/game-points-migration.sql` (game) | customer on game sessions, points trigger, record-session busy-TV fix | `select count(*) from information_schema.columns where table_schema='game' and table_name='sessions' and column_name in ('customer_id','points_rule');` → 2 |
| 3 | `supabase/billiards-points-migration.sql` (billiards) | same for billiards | same query with `billiards` → 2 |
| 4 | `loyalty-zone-admin-migration.sql` (hub) | `public.loyalty_*` functions the game/billiards Points sections call (rewards, requests, customers, adjust; grant checked in the database) and `my_venue_sessions` for the customer's Played tab | `select count(*) from pg_proc where proname like 'loyalty\_%' or proname = 'my_venue_sessions';` → 13 |
| 5 | `retire-per-app-superadmin-migration.sql` (hub) | per-business "superadmin" grants become "admin"; only global superadmins own businesses | run its "who is affected" query **first**; anyone listed who should own everything → set `profiles.role = 'superadmin'` before running |

1–4 are safe before any code deploy: nothing earns until a customer is
attached, and that needs the new screens. #2 changes game behaviour at once in
one way: recording a session on a TV whose timer is running is now refused (it
used to mark the TV free mid-session).

## 2. Deploy (merge PR = Vercel deploy)

1. **Hub** → `main`. Gives: customer portals, sign-up links, futsal API scoping.
2. **Game** `feat/points` → `main`. **After SQL #2 and #4** — the session screen
   reads the new columns and the Points section calls the new functions.
3. **Billiards** `feat/points` → `master`. After SQL #3 and #4.
4. SQL #5 any time after the hub deploy.

## 3. Smoke test (signed in, on a phone)

- **Game**: open a session on a TV → add a test customer's phone → name
  appears. Close after ≥ 60 min (or Record 60 min with the phone) → toast
  "+10 points to …". Customer: `/games/account` shows 10, the session under
  **Played**, the +10 under **History**.
- **Game busy TV**: with a timer running on TV X, try Record session on TV X →
  refused with a clear message.
- **Rewards, owner**: game admin → **Points → Rewards** → create a reward.
  Customer requests it on `/games/account` → **Points → Requests** shows it
  (with the badge in the nav) → approve → game balance drops, futsal balance
  unchanged. **Points → Customers** lists the customer; open them and adjust ±.
- **Billiards**: session screen shows the customer card with "Points are not
  switched on yet"; Pricing shows the Points card "Not set yet". The Points
  section works the same as the game's. (Leave the rule off until the client
  decides the numbers.)
- **Scoping**: a game-only admin cannot open billiards' Points section, and a
  billiards-only admin cannot open the game's; only a superadmin sees reward
  create/edit/delete and "clear history".
- **Customer side**: signed out, open `/billiards/account` → login → back on
  the billiards page. Settings (gear) → back arrow returns to the venue page.
- **Sign-up**: `/register?from=game` shows "Sign up to earn points at ACJ
  Gaming" and lands on `/games/account`. Signed in already → the same link goes
  straight to `/games/account`.

## 4. If something goes wrong

- **Stop awarding points** without a deploy: owner sets the rule to off on the
  game / billiards Pricing page (or `update point_rules set is_active = false
  where app = 'game';`). Sessions keep working; nothing new is earned.
- **Code**: promote the previous deployment in Vercel. All SQL is additive;
  the old code ignores the new columns, tables and functions.
- **A session's points did not appear**: points never block checkout; a
  failure is logged as a warning. Re-enter the same phone on that session
  (within 15 minutes, or as superadmin later) to re-sync.
- **Wrong customer on a finished session**: a superadmin changes it on the
  session (points move; audited).
- **Points section shows an error**: SQL #4 has not been run.

## 5. Counter QR codes

One account works at all three businesses. Point these at each counter:

- ACJ Gaming: `https://myathida-futsal.vercel.app/register?from=game`
- CueX Billiards: `https://myathida-futsal.vercel.app/register?from=billiards`

New customers sign up and land on that venue's points page; customers already
signed in go straight there. Existing customers can also bookmark
`/games/account` or `/billiards/account`, or tap **My points** on the venue
page of the park site.

Staff notes (Burmese): `docs/points-staff-guide-my.md`.

## 6. Open decisions for the client

- Billiards points rule (points per hour) — placeholder is OFF.
- Gaming and billiards rewards (none exist yet; the owner creates them under
  **Points → Rewards** in each admin app).
- Burmese wording added in this work was written by the developer's assistant
  and should be read once by a native speaker.
