# Juppies

A team hub for the NUS Jupitans: training and match RSVPs, match results, player stats and match videos.
Players pick their name once (no logins). Admins sign in with a shared PIN.

**Everyone can see** the schedule, who's coming, results, scorers, assists, the player of the match, the season leaderboard and attendance.
**Only admins can change** things: the schedule, results, stats, players and videos. Only admins can read the feedback inbox.

| Part | What it does | Who touches it |
|---|---|---|
| Supabase (Postgres database) | Stores everything and enforces every rule | Admins, to fix data by hand in the Table Editor |
| `supabase/setup.sql` | Tables, security rules and the functions the app calls | Nobody after setup |
| `index.html`, `css/`, `js/`, `logo.png` (GitHub Pages) | The app players open on their phones | Nobody after setup |

Try it with `npm start` and open <http://localhost:8000>. With no Supabase project configured (empty `SUPABASE_URL`), it runs in **demo mode**: the real 2026/27 fixtures, results and streams, with made-up players and trainings. In demo mode any PIN signs you in as admin.

---

## Everyday admin (no code)

| Task | Where |
|---|---|
| **Sign in** | Admin → type the admin PIN. The device stays signed in for 30 days |
| **Enter a match result** | Admin → *Match results* lists finished matches without a score. Open one → **Enter result** → tick who played, add goals and assists (the score adds itself up), pick the player of the match → **Save result** |
| Fix a result | Open the match (Matches → Results, or Stats → Results) → **Edit**. **Delete result** removes it |
| Upload or update the schedule | Admin → *Upload match schedule*. Re-uploading updates times and never overwrites RSVPs players gave in the app |
| Cancel a training or match | Open the session → **Cancel session** |
| Extra training or friendly | Admin → *Add a one-off session* |
| Add a match video | Open the match → paste a YouTube link |
| Player joins or leaves | Admin → *Players* (deactivating keeps their history and stats) |
| Read feedback | Admin → *Feedback inbox* |
| Download everything | Admin → *Export to Excel* (RSVPs, results, player stats) |

**Result rules:** our score adds itself up from player goals as you type. To record an own goal, type a higher score and the extra is kept as "goals without a scorer". Assists can't exceed the score. The player of the match must be someone who played.
**Attendance:** once a match has a lineup (who played), attendance counts who actually played. Otherwise, including for trainings, it counts who RSVP'd Going.

### Fixing data by hand (Supabase → Table Editor)
The Table Editor works like a spreadsheet. It's fine to correct a typo or change an RSVP after the cutoff. **Cancel sessions instead of deleting them** (deleted trainings get recreated).

| Table | One row per | Notes |
|---|---|---|
| `settings` | (one row) | `training_lock_hours` / `match_lock_hours`: RSVP cutoff (2 and 12). `weeks_ahead`: how far ahead trainings appear (3). `training_start`: first date trainings are created from. `match_venue`: shown on every match |
| `players` | player | `active` false hides them from the name list |
| `training_slots` | weekly training | `weekday` 0 = Sunday … 6 = Saturday. New times apply to sessions created from then on |
| `sessions` | training or match | `status` is Active/Cancelled |
| `rsvps` | player per session | |
| `videos` | YouTube link | |
| `feedback` | message | `status` is New/Seen/Done |
| `match_results` | match with a result | Score and player of the match |
| `player_stats` | player per match they played | Goals and assists. Being listed means they played |

---

## One-time setup (about 20 minutes)

### 1. Create the database
1. Sign up at [supabase.com](https://supabase.com) and create a **New project** (region: *Southeast Asia (Singapore)*). Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste all of [`supabase/setup.sql`](supabase/setup.sql), click **Run**. You should see "Success. No rows returned".
3. To load the team's real data, run `private-data/real-data.sql` the same way. That file is kept out of git on purpose because it holds real names.

### 2. Set the admin PIN
In **SQL Editor → New query**, run this with your own PIN (at least 6 characters; longer is safer):

```sql
select set_admin_pin('your-pin-here');
```

Share the PIN only with admins. Run the same line again to change it, which also signs out every device. Do this whenever an admin leaves.

### 3. Connect the app
1. In Supabase, go to **Project Settings → API** (or **API Keys**) and copy the **Project URL** and the **anon public** key (newer projects call it the *publishable* key).
2. Paste both into [`js/config.js`](js/config.js). They're public by design, so it's fine to commit them.
3. Commit and push. GitHub Pages republishes in a minute or two.

### 4. Publish on GitHub Pages (once)
Repo **Settings → Pages → Deploy from a branch → `main`, `/ (root)` → Save**.

### Updating the database later
When `supabase/setup.sql` changes, paste it into the SQL Editor and **Run** again. It updates rules and functions and never deletes data.

---

## For developers

No build step: the app is plain ES modules served as static files. That keeps GitHub Pages deploys to a commit and lets a non-developer edit `js/config.js` in the GitHub web editor.

```
index.html              page shell
css/theme.css           design tokens (light + dark)
css/app.css             layout and components
js/main.js              entry point: wires state, rendering, events
js/store.js             UI state; setState() re-renders
js/render.js            state -> DOM (tabs, page, bottom sheet)
js/actions.js           click / submit / change / input handlers
js/controller.js        load data, run actions, admin sign-in
js/api.js               action -> database function (RPC_CALLS), or the demo backend
js/supabase-client.js   the shared Supabase client
js/vendor/supabase.js   supabase-js 2.117.3, self-hosted
js/demo-backend.js      in-memory backend mirroring supabase/setup.sql
js/demo-schedule.js     2026/27 fixtures + results with made-up players (demo and tests)
js/logic/               pure, tested functions: dates, ids, rsvp, match-result, stats, selectors, schedule-import
js/ui/                  html`` templating (auto-escaping), formatting, icons, toast, theme, effects (motion)
js/views/               one module per page, plus shared components
js/admin/excel.js       Excel import/export (SheetJS from CDN)
assets/                 illustrations (optional; see assets/README.md)
supabase/setup.sql      the whole database: tables, row-level security, functions
tests/                  node:test unit tests, plus database.test.js which runs setup.sql in PGlite
```

```bash
npm install  # once: installs PGlite (real Postgres in WebAssembly) for the database tests
npm test     # all tests (Node 20+)
npm start    # serves the app on http://localhost:8000 (ES modules don't load from file://)
```

**Conventions**
- Views are pure functions of state that return `html```, which escapes every interpolated value. Raw markup only goes through `trusted()`, which is used for static icons.
- Views don't attach listeners. They declare `data-action` / `data-form` / `data-change` / `data-input`, and `js/actions.js` maps those to handlers.
- Every app action is one Postgres function. `RPC_CALLS` in `js/api.js` is the full list, and `tests/database.test.js` fails if a function or parameter name drifts.
- After any write, the app reloads the full bootstrap payload. The data is small, and this keeps the screen identical to the database.
- Rules are enforced in the database and repeated in the browser for instant feedback: `validateMatchResult` ↔ `match_result_errors`, `isLocked` ↔ `submit_rsvp`, `matchId`/`youTubeId` ↔ `match_id`/`youtube_id`. Each copy names its twin, and the database tests check the id helpers agree.
- Motion is reserved for big moments: page entrance, the sheet opening, the scoreboard reveal and confetti on a saved win. It plays only on navigation or opening (never on re-render), and is off under `prefers-reduced-motion`.

**Security model**
- The browser uses the public anon key. Row-level security lets it **read** public tables only. All **writes** go through `security definer` functions that check every rule, and direct inserts, updates and deletes are refused. Supabase's default grants are revoked in `setup.sql`, and the database tests prove this.
- Admins share one PIN, checked only by the database and stored as a bcrypt hash. A correct PIN returns a session token (30 days, stored hashed) that the app sends in the `x-admin-token` header, and every admin function checks it through `is_admin()`. Five wrong PINs in a row lock sign-in for 15 minutes. The trade-off: the app can't tell which admin made a change, and removing an admin means changing the PIN.
- No player logins: anyone with the link can RSVP or send feedback under any player's name. That's the agreed trade-off for a team tool, so don't store anything sensitive. RSVP reasons, attendance and stats are visible to everyone with the link. Feedback and inactive players are admin-only.
- All text is length-capped by database constraints and HTML-escaped when shown. Videos must be https YouTube links, stored in one canonical form and embedded only through youtube-nocookie.
- `index.html` sets a Content Security Policy (code only from this site and SheetJS, network only to Supabase, frames only YouTube). SheetJS is pinned with an integrity hash, and supabase-js is self-hosted.
- `.gitignore` keeps real data (`private-data/`, `sheet-import/`), local tooling and OS files out of the repo.

## Handing over to a new owner
1. Supabase: **Organization settings → Members → Invite** the new owner, then make them *Owner*.
2. Give them the admin PIN.
3. Transfer the GitHub repo (repo **Settings → Transfer ownership**), or add them as a collaborator.

## Troubleshooting
| Problem | Fix |
|---|---|
| "Couldn't load the team data" | Check `SUPABASE_URL` and the key in `js/config.js`, and that `setup.sql` has been run. |
| "No admin PIN has been set yet" | Run `select set_admin_pin('your-pin-here');` in the SQL Editor. |
| Forgot the PIN | Run the same line with a new PIN. The old one can't be recovered. |
| "Too many wrong PINs" | Wait 15 minutes. Devices already signed in keep working. |
| A name is missing from the picker | Admin → Players → check they're active. |
| Dates imported in the wrong year | Set **Season starts in** correctly before Preview, then re-import. |
| A change on GitHub isn't showing | GitHub Pages caches for up to 10 minutes. Wait, then refresh. |
