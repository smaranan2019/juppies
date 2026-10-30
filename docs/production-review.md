# Production review

**Bottom line:** Juppies is safe to put in front of the team. The biggest remaining risk is a product decision rather than a bug: anyone with the link can see the team's names and absence reasons, and can RSVP as anyone. A database-checked team code fixes that (see *Left for later*).

Scope: a team tool for about 30 players in Singapore. The worst failure would be **leaking players' personal details or letting a stranger change team data**. Everything below is prioritised around that.

## Fixed in this pass

| # | Problem | Why it mattered | Fix |
|---|---|---|---|
| 1 | Network calls had no timeout | On a bad connection the app could sit on "Loading…" forever, with no error and no retry | Every database call gives up after 20 s with a clear message (`js/api.js`) |
| 2 | A failed refresh looked like success | After the first load, a failed reload kept showing old data silently, e.g. yesterday's RSVPs as if current | A red "Couldn't refresh, showing data from 3:41 PM · Try again" banner (`js/render.js`) |
| 3 | Overlapping loads could race | A save's reload and the app regaining focus could finish out of order, so older data overwrote newer | Only the newest load is applied (`latestOnly` in `js/lib/async.js`, tested) |
| 4 | Status colours failed contrast | Going, Not going and TBC text measured 3.3–3.9:1, under the 4.5:1 WCAG AA minimum, which is hard to read in sunlight or with low vision | Darker light-mode shades, all now 4.9–5.9:1. Dark mode already passed |
| 5 | Every visitor downloaded the Excel library | 950 KB on each phone, each visit, though only admins import or export | SheetJS loads on first admin use, still pinned by its integrity hash (`js/admin/excel.js`) |
| 6 | Feedback could be flooded | Anyone can submit, so a script could fill the inbox and the database | The database accepts at most 10 feedback messages a minute across the team (tested) |
| 7 | Search engines could index team data | Real names and availability could appear in Google results | `noindex, nofollow` on the page |
| 8 | Opening a sheet didn't move focus | Keyboard and screen-reader users stayed behind the dialog | Focus moves into the sheet on open and back to where it was on close |
| 9 | No CI | Broken changes could be pushed without anyone running the tests | GitHub Actions runs all 38 tests on every push |
| 10 | No architecture doc | New developers had to reverse-engineer the layers | `ARCHITECTURE.md`: layers diagram, data flow, decisions and trade-offs |

Fixed in earlier passes and re-checked now: XSS (auto-escaping templates), the Content Security Policy, no secrets in the repo, read-only browser grants with all writes going through rule-checking functions, admin-only functions, length caps, YouTube-only video links, and `npm audit` (0 vulnerabilities).

## How each layer holds up

| Layer | Status |
|---|---|
| **Database** (`supabase/setup.sql`) | Deny by default: browsers can only read public tables, and all writes go through functions that check the rules. Admin powers come from the `admins` table. Tested in real Postgres, including Supabase's permissive default grants |
| **Data** (`api.js`, `auth.js`) | One client, one path for every call, timeouts, and friendly errors. `RPC_CALLS` is tested against the real function signatures |
| **State** (`store.js`, `controller.js`) | One source of truth. Stale data is labelled, and racing loads are prevented |
| **UI** (`render.js`, `views/`) | Pure views with escaped output. Distinct loading, error, stale, empty and demo states. Motion respects reduced-motion settings |
| **Rules** (`logic/`) | Pure and unit-tested. Mirrored in SQL where the server must enforce them |

## How it's tested

- **`npm test`**: 38 tests. They cover the pure rules, the schedule importer (including the real 2026/27 layout), and the async helper. The database suite runs `setup.sql` in PGlite and checks permissions, RSVP locking, result validation, video rules, the feedback limit, imports, and that the browser and database agree on ids.
- **CI** runs the same suite on every push.
- **In the browser**: see the chat summary for what was and wasn't checked in this pass.

## Left for later (in priority order)

| # | Item | Why | Suggested fix |
|---|---|---|---|
| 1 | **Anyone with the link can read team data and RSVP as anyone** | Names and absence reasons ("injured") are effectively public | A team code checked by the database: reads and writes require it, and direct table reads are switched off. About half a day |
| 2 | **Supabase free projects pause after about a week without activity** | The app would stop loading, e.g. over the off-season break | Open the app weekly, or upgrade to the Pro plan before long breaks |
| 3 | **Backups** | The free plan's backups are limited | Export regularly (Admin → Export to Excel), or schedule a `pg_dump` |
| 4 | Sign-in emails may not reach every admin | Supabase's built-in sender is limited | Set up custom SMTP (README, *About email delivery*) |
| 5 | Focus can leave the open sheet with Tab | Minor keyboard accessibility gap (focus moves in, but isn't trapped) | Add a focus trap to the dialog |
| 6 | Missing illustrations cause three 404 requests per page load | Harmless, but noisy in the console and wasted requests | Add the three `assets/*.webp` files (prompts in `assets/README.md`) |
| 7 | The bootstrap payload grows every season | Slower loads after several seasons | Return only the selected season, plus a stats summary |
| 8 | No linter | Style drift as more people edit | Add ESLint to CI |
| 9 | `js/vendor/supabase.js` is updated by hand | Dependabot can't see it | Check for supabase-js updates each season |
| 10 | The lock countdown uses the phone's clock | A wrong phone clock shows a wrong cutoff (the server still enforces the real one) | Use the server's `now` from `bootstrap()` |

Deliberately out of scope: translation and other locales (an English-speaking team in Singapore), and error monitoring (worth adding if the app grows beyond one team).

## Action needed in Supabase

`supabase/setup.sql` changed (the feedback limit). Paste it into **SQL Editor → Run** again. It's safe to re-run and won't touch your data.
